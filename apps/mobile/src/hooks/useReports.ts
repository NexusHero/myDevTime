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
import { reportWindow, type ReportRange } from '../reports/window.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * The Reports data source (REQ-005/028): when an API base URL is configured the
 * hook fetches, for the selected window (`week`/`month`/`year`, `reportWindow`), the
 * workspace time summary, the billable-money summary, the project budgets (with
 * per-budget status), the overtime balance, and the catalog (for project names),
 * then joins them;
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

export function useReports(range: ReportRange = 'week'): ReportsResource {
  const base = apiBaseUrl
  const window = reportWindow(range, new Date())
  const resource = useAsync<ReportsData>(
    async () => {
      if (base === null) {
        return Promise.resolve(EMPTY_REPORTS)
      }
      const [summary, billing, catalog, budgetList, overtime] = await Promise.all([
        fetchSummary(base, window),
        fetchBillingSummary(base, window),
        fetchCatalog(base),
        fetchBudgets(base),
        fetchWorktimeSummary(base, window),
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
    `${base ?? 'demo'}:${range}:${window.from}`,
  )
  return { ...resource, live: base !== null }
}
