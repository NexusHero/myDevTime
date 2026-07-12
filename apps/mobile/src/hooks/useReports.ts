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
import { LOCAL_WORKSPACE_ID, useLocalDb } from '../localDb/context.js'
import { computeOfflineReports } from '../localDb/reports.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * The Reports data source (REQ-005/028): when an API base URL is configured the
 * hook fetches, for the trailing week, the workspace time summary, the
 * billable-money summary, the project budgets (with per-budget status), the
 * overtime balance, and the catalog (for project names), then joins them;
 * otherwise — the default in local dev and the test gate — it resolves
 * illustrative demo figures. `live` lets the UI flag demo data. Every figure on
 * the Reports card is now API-backed.
 */
const H = 3_600_000
const M = 60_000

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
    budgets: [
      {
        id: 'finanzo',
        name: 'Finanzo',
        ratio: 0.65,
        consumed: 78 * H,
        basis: 'hours',
        currencyCode: 'EUR',
      },
      {
        id: 'sync-engine',
        name: 'Sync engine',
        ratio: 0.97,
        consumed: 58 * H,
        basis: 'hours',
        currencyCode: 'EUR',
      },
      {
        id: 'nordwind',
        name: 'Website relaunch',
        ratio: 1.1,
        consumed: 44 * H,
        basis: 'hours',
        currencyCode: 'EUR',
      },
    ],
    overtimeMs: 9 * H + 30 * M,
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
  const db = useLocalDb()
  const range = trailingWeek()
  const resource = useAsync<ReportsData>(
    async () => {
      // Offline (no API, local store open): compute from the local store via the
      // deterministic core (ADR-0040/0005) — real time + money, no demo figures.
      if (base === null) {
        return db === null ? demoReports() : computeOfflineReports(db, LOCAL_WORKSPACE_ID, range)
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
    `${base ?? (db !== null ? 'local-db' : 'demo')}:${range.from}`,
  )
  return { ...resource, live: base !== null }
}
