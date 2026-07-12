import {
  budgetConsumptions,
  priceBillableEntries,
  summarizeEntries,
  type BudgetLimit,
  type ScopedRateRule,
  type TimeEntry as CoreEntry,
} from '@mydevtime/domain'
import {
  listBudgets,
  listEntries,
  listEntriesInRange,
  listProjects,
  listRates,
  type LocalBudget,
  type LocalRate,
  type LocalTimeEntry,
  type LocalDb,
} from '@mydevtime/local-db'
import type { ReportProject } from '../api/reports.js'
import type { BudgetRingRow } from '../api/budgets.js'
import type { ReportsData } from '../hooks/useReports.js'

/**
 * Offline Reports (REQ-005, ADR-0040): compute the same figures the server's
 * `billing`/`tracking` modules return, but from the local SQLite store via the
 * **deterministic core** (`packages/domain`) — no fabricated numbers. Time comes
 * from `summarizeEntries`, billable money from `priceBillableEntries`, and budget
 * rings from `budgetConsumptions`. This module is the impure edge: it reads rows
 * and the clock, the arithmetic lives in the pure, tested core.
 *
 * A standalone store has one currency; overtime needs recorded shifts (no offline
 * punch-clock yet), so it is honestly 0 until that path lands.
 */
const LOCAL_CURRENCY = 'EUR'
const NO_PROJECT = '(none)'
const PROJECT_SCOPE = 'project'
/** Effectively unbounded for a local device; sync/pagination is a later concern. */
const ALL_ENTRIES = 100_000

/** Map a stored local entry onto the core `TimeEntry` (absolute instants). */
function toCore(e: LocalTimeEntry): CoreEntry {
  return {
    id: e.id,
    start: Date.parse(e.startedAt),
    end: e.endedAt === null ? null : Date.parse(e.endedAt),
    billable: e.billable,
    source: e.source,
    ...(e.projectId === null ? {} : { projectId: e.projectId }),
    ...(e.taskId === null ? {} : { taskId: e.taskId }),
  }
}

function toRule(r: LocalRate): ScopedRateRule {
  return {
    level: r.level,
    scopeId: r.scopeId,
    amountMinorPerHour: r.amountMinorPerHour,
    effectiveFrom: Date.parse(r.effectiveFrom),
  }
}

function toLimit(b: LocalBudget): BudgetLimit {
  return {
    id: b.id,
    scope: b.scope,
    scopeId: b.scopeId,
    basis: b.basis,
    limit: b.limitAmount,
    period: b.period,
    thresholds: b.thresholds,
  }
}

/** Compute the Reports read model for the trailing window from the local store. */
export async function computeOfflineReports(
  db: LocalDb,
  workspaceId: string,
  range: { from: string; to: string; tz: string },
  now: number = Date.now(),
): Promise<ReportsData> {
  const [projects, windowRows, allRows, rateRows, budgetRows] = await Promise.all([
    listProjects(db, workspaceId),
    listEntriesInRange(db, workspaceId, range.from, range.to),
    listEntries(db, workspaceId, ALL_ENTRIES),
    listRates(db, workspaceId),
    listBudgets(db, workspaceId),
  ])

  const nameById = new Map(projects.map(p => [p.id, p.name]))
  const clientByProject = new Map<string, string | null>(projects.map(p => [p.id, p.clientId]))
  const rates = rateRows.map(toRule)
  const windowCore = windowRows.map(toCore)

  const summary = summarizeEntries(windowCore, { tz: range.tz, asOf: now })
  const billing = priceBillableEntries(windowCore, clientByProject, rates, now)
  const consumptions = budgetConsumptions(
    budgetRows.map(toLimit),
    allRows.map(toCore),
    clientByProject,
    rates,
    now,
  )

  const byProject: ReportProject[] = summary.byProject.map(p => ({
    id: p.projectId,
    name: p.projectId === NO_PROJECT ? 'No project' : (nameById.get(p.projectId) ?? p.projectId),
    spentMs: p.spentMs,
    daily: [...p.daily],
  }))

  const budgets: BudgetRingRow[] = consumptions
    .filter(c => c.budget.scope === PROJECT_SCOPE)
    .map(c => ({
      id: c.budget.id,
      name: nameById.get(c.budget.scopeId) ?? c.budget.scopeId,
      ratio: c.status.ratio,
      consumed: c.status.consumed,
      basis: c.budget.basis,
      currencyCode: LOCAL_CURRENCY,
    }))

  return {
    totalMs: summary.totalMs,
    billableMinor: billing.billableMinor,
    currencyCode: LOCAL_CURRENCY,
    byProject,
    budgets,
    overtimeMs: 0,
  }
}
