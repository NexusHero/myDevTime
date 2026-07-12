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
import { useLocalDb } from '../localDb/LocalDbProvider.js'
import { getSummary, getProjectSummary, getWorktimeBalance, listProjects } from '@mydevtime/local-db'

/**
 * The Reports data source (REQ-005/028): when an API base URL is configured the
 * hook fetches, for the trailing week, the workspace time summary, the
 * billable-money summary, the project budgets (with per-budget status), the
 * overtime balance, and the catalog (for project names), then joins them;
 * otherwise — the default in local dev and the test gate — it resolves
 * illustrative demo figures. `live` lets the UI flag demo data. Every figure on
 * the Reports card is now API-backed.
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
  const db = useLocalDb()
  const range = trailingWeek()
  const resource = useAsync<ReportsData>(
    async () => {
      if (base !== null) {
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
      }
      
      const [localSummary, localProjectSummary, localOvertime, localProjects] = await Promise.all([
        getSummary(db, range.from, range.to),
        getProjectSummary(db, range.from, range.to),
        getWorktimeBalance(db, range.from, range.to),
        listProjects(db)
      ])
      
      const nameById = new Map<string, string>()
      for (const p of localProjects) {
        nameById.set(p.id, p.name)
      }
      
      return {
        totalMs: localSummary.totalMs,
        billableMinor: Math.round(localSummary.billableMs / 3600000 * 10000), // Approx hourly rate 100 EUR
        currencyCode: 'EUR',
        byProject: localProjectSummary.map(ps => ({
          id: ps.projectId,
          name: nameById.get(ps.projectId) || 'Unknown',
          spentMs: ps.spentMs,
          daily: ps.daily,
        })),
        budgets: [], // Offline budgets not fully implemented yet
        overtimeMs: localOvertime,
      }
    },
    `${base ?? 'local-db'}:${range.from}`,
  )
  return { ...resource, live: base !== null }
}
