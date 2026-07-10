import { apiBaseUrl } from '../config.js'
import {
  fetchBillingSummary,
  fetchSummary,
  toReportProjects,
  type ReportProject,
} from '../api/reports.js'
import { fetchCatalog } from '../api/tracking.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * The Reports data source (REQ-005): when an API base URL is configured the hook
 * fetches, for the trailing week, the workspace time summary, the billable-money
 * summary, and the catalog (for project names), then joins them; otherwise — the
 * default in local dev and the test gate — it resolves illustrative demo figures.
 * `live` lets the UI flag demo data. Budget rings and overtime still come from
 * demo constants in the screen until the budget and work-time reads are wired.
 */
const H = 3_600_000
const M = 60_000

export interface ReportsData {
  readonly totalMs: number
  readonly billableMinor: number
  readonly currencyCode: string
  readonly byProject: readonly ReportProject[]
}

export interface ReportsResource extends AsyncResource<ReportsData> {
  readonly live: boolean
}

function demoReports(): ReportsData {
  const day = (...hours: number[]): number[] => hours.map(h => h * H)
  return {
    totalMs: 41 * H + 15 * M,
    billableMinor: 486_000,
    currencyCode: 'EUR',
    byProject: [
      { id: 'finanzo', name: 'Finanzo', spentMs: 78 * H, daily: day(6, 5, 7, 8, 6, 2, 0) },
      { id: 'sync-engine', name: 'Sync engine', spentMs: 58 * H, daily: day(4, 6, 5, 9, 7, 3, 1) },
      {
        id: 'nordwind',
        name: 'Website relaunch',
        spentMs: 44 * H,
        daily: day(3, 4, 2, 5, 6, 4, 2),
      },
    ],
  }
}

/** The trailing 7-day window ending at the next UTC midnight (the summary range). */
function trailingWeek(): { from: string; to: string; tz: string } {
  const to = new Date()
  to.setUTCHours(0, 0, 0, 0)
  to.setUTCDate(to.getUTCDate() + 1)
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 7)
  return { from: from.toISOString(), to: to.toISOString(), tz: 'UTC' }
}

export function useReports(): ReportsResource {
  const base = apiBaseUrl
  const range = trailingWeek()
  const resource = useAsync<ReportsData>(
    async () => {
      if (base === null) return demoReports()
      const [summary, billing, catalog] = await Promise.all([
        fetchSummary(base, range),
        fetchBillingSummary(base, range),
        fetchCatalog(base),
      ])
      const nameById = new Map<string, string>()
      for (const client of catalog)
        for (const project of client.projects) nameById.set(project.id, project.name)
      return {
        totalMs: summary.totalMs,
        billableMinor: billing.billableMinor,
        currencyCode: billing.currencyCode,
        byProject: toReportProjects(summary, nameById),
      }
    },
    `${base ?? 'demo'}:${range.from}`,
  )
  return { ...resource, live: base !== null }
}
