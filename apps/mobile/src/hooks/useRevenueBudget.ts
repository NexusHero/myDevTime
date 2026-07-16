import { effectiveRateMinorPerHour } from '@mydevtime/domain'
import { apiBaseUrl } from '../config.js'
import { fetchBillingSummary, fetchSummary } from '../api/reports.js'
import { fetchCatalog } from '../api/tracking.js'
import { fetchOpenAging, type OpenAging } from '../api/invoicing.js'
import { buildClientRevenueRows, type ClientRevenueRow } from '../reports/revenueBudget.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * The Reports "Revenue & Budget" data source (D13, REQ-005). For the trailing week it
 * fetches the time summary, the billable-money summary, the catalog (client grouping)
 * and the all-time open-billable aging, then derives — via the deterministic core —
 * revenue per client, the average effective rate and the billable share. When no API
 * is configured it resolves **empty** (no fabricated money); `live` flags API-backed
 * data. Every figure is the server core's; this hook only joins and rolls up.
 */
export interface RevenueBudgetData {
  readonly revenueMinor: number
  readonly openMinor: number
  readonly billablePct: number
  readonly effectiveRateMinorPerHour: number | null
  readonly currencyCode: string
  readonly clients: readonly ClientRevenueRow[]
  readonly aging: OpenAging | null
}

export interface RevenueBudgetResource extends AsyncResource<RevenueBudgetData> {
  readonly live: boolean
}

const EMPTY: RevenueBudgetData = {
  revenueMinor: 0,
  openMinor: 0,
  billablePct: 0,
  effectiveRateMinorPerHour: null,
  currencyCode: 'EUR',
  clients: [],
  aging: null,
}

/** The trailing 7-day window ending at the next UTC midnight (matches `useReports`). */
function trailingWeek(): { from: string; to: string; tz: string } {
  const to = new Date()
  to.setUTCHours(0, 0, 0, 0)
  to.setUTCDate(to.getUTCDate() + 1)
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 7)
  return { from: from.toISOString(), to: to.toISOString(), tz: 'UTC' }
}

export function useRevenueBudget(): RevenueBudgetResource {
  const base = apiBaseUrl
  const range = trailingWeek()
  const resource = useAsync<RevenueBudgetData>(
    async () => {
      if (base === null) return Promise.resolve(EMPTY)
      const [summary, billing, catalog, aging] = await Promise.all([
        fetchSummary(base, range),
        fetchBillingSummary(base, range),
        fetchCatalog(base),
        fetchOpenAging(base),
      ])
      const clients = buildClientRevenueRows(
        catalog,
        summary.byProject.map(p => ({
          projectId: p.projectId,
          spentMs: p.spentMs,
          billableMs: p.billableMs,
        })),
        billing.byProject.map(p => ({ projectId: p.projectId, costMinor: p.costMinor })),
      )
      return {
        revenueMinor: billing.billableMinor,
        openMinor: aging.totalMinor,
        billablePct:
          summary.totalMs > 0 ? Math.round((summary.billableMs / summary.totalMs) * 100) : 0,
        effectiveRateMinorPerHour: effectiveRateMinorPerHour(
          billing.billableMinor,
          summary.billableMs,
        ),
        currencyCode: billing.currencyCode,
        clients,
        aging,
      }
    },
    `${base ?? 'demo'}:revbudget:${range.from}`,
  )
  return { ...resource, live: base !== null }
}
