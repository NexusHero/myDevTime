import { apiBaseUrl } from '../config.js'
import {
  fetchBillingSummary,
  fetchSummary,
  toReportProjects,
  type ReportProject,
} from '../api/reports.js'
import {
  fetchBudgetStatus,
  fetchBudgets,
  toBudgetRings,
  type BudgetRingRow,
} from '../api/budgets.js'
import { fetchWorktimeSummary } from '../api/worktime.js'
import { fetchCatalog } from '../api/tracking.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * The Reports data source (REQ-005/028): when an API base URL is configured the
 * hook fetches, for the trailing week, the workspace time summary, the
 * billable-money summary, the project budgets (with per-budget status), the
 * overtime balance, and the catalog (for project names), then joins them;
 * otherwise — the default in local dev and the test gate — it resolves **empty**.
 * The app fabricates no figures. `live` lets the UI flag that the data is
 * API-backed; every figure on the Reports card is the deterministic core's.
 */
export interface ReportsData {
  readonly totalMs: number
  readonly billableMinor: number
  readonly currencyCode: string
  readonly byProject: readonly ReportProject[]
  readonly budgets: readonly BudgetRingRow[]
  /** Signed overtime balance (net worked − target) over the window. */
  readonly overtimeMs: number
}

export interface ReportsResource extends AsyncResource<ReportsData> {
  readonly live: boolean
}

const EMPTY_REPORTS: ReportsData = {
  totalMs: 0,
  billableMinor: 0,
  currencyCode: 'EUR',
  byProject: [],
  budgets: [],
  overtimeMs: 0,
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
      if (base === null) {
        return Promise.resolve(EMPTY_REPORTS)
      }
      const [summary, billing, catalog, budgetList, overtime] = await Promise.all([
        fetchSummary(base, range),
        fetchBillingSummary(base, range),
        fetchCatalog(base),
        fetchBudgets(base),
        fetchWorktimeSummary(base, range),
      ])
      const statuses = await Promise.all(budgetList.map(b => fetchBudgetStatus(base, b.id)))
      const nameById = new Map<string, string>()
      for (const client of catalog)
        for (const project of client.projects) nameById.set(project.id, project.name)
      return {
        totalMs: summary.totalMs,
        billableMinor: billing.billableMinor,
        currencyCode: billing.currencyCode,
        byProject: toReportProjects(summary, nameById),
        budgets: toBudgetRings(statuses, nameById),
        overtimeMs: overtime.balanceMs,
      }
    },
    `${base ?? 'demo'}:${range.from}`,
  )
  return { ...resource, live: base !== null }
}
