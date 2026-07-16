import { and, eq, gte, isNull, lt } from 'drizzle-orm'
import {
  budgetStatus,
  costOf,
  entryDuration,
  evaluateThresholds,
  rateForEntry,
  sumMoney,
  type Budget as CoreBudget,
  type BudgetStatus,
  type RateLevel,
  type ScopedRateRule,
  type ThresholdEvaluation,
} from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { budgetAlerts, budgets, projects, rates, timeEntries, workspaces } from '../../db/schema.js'
import { NotFoundError, ValidationError } from '../../errors.js'

/**
 * The money service (REQ-005) — the impure edge over the deterministic core in
 * `packages/domain/budgets`. Every function takes a `workspaceId` non-optionally
 * and scopes every query by it (isolation by construction); all arithmetic that
 * reaches an amount is delegated to the pure core so it stays exact and float-free
 * (ADR-0005).
 */

export type Rate = typeof rates.$inferSelect
export type BudgetRow = typeof budgets.$inferSelect

const RATE_LEVELS: readonly RateLevel[] = ['workspace', 'client', 'project', 'task']
const BUDGET_SCOPES = ['project', 'client'] as const
const BUDGET_BASES = ['hours', 'money'] as const
const BUDGET_PERIODS = ['total', 'monthlyRecurring'] as const

function one<T>(rows: readonly T[], entity: string): T {
  const row = rows[0]
  if (!row) throw new NotFoundError(`${entity} not found`)
  return row
}

function assertMinorInt(n: number, what: string): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new ValidationError(`${what} must be a non-negative integer (minor units)`)
  }
}

// ── Rates ────────────────────────────────────────────────────────────────────

export interface RateInput {
  level: RateLevel
  scopeId?: string | null | undefined
  amountMinorPerHour: number
  effectiveFrom: Date
}

export async function createRate(db: Db, workspaceId: string, input: RateInput): Promise<Rate> {
  if (!RATE_LEVELS.includes(input.level)) throw new ValidationError('invalid rate level')
  assertMinorInt(input.amountMinorPerHour, 'rate')
  // The workspace level is the default and carries no scope; the others must name one.
  const scopeId = input.level === 'workspace' ? null : (input.scopeId ?? null)
  if (input.level !== 'workspace' && !scopeId) {
    throw new ValidationError(`a ${input.level} rate needs a scopeId`)
  }
  const rows = await db
    .insert(rates)
    .values({
      workspaceId,
      level: input.level,
      scopeId,
      amountMinorPerHour: input.amountMinorPerHour,
      effectiveFrom: input.effectiveFrom,
    })
    .returning()
  return one(rows, 'rate')
}

export function listRates(db: Db, workspaceId: string): Promise<Rate[]> {
  return db
    .select()
    .from(rates)
    .where(eq(rates.workspaceId, workspaceId))
    .orderBy(rates.level, rates.effectiveFrom)
}

export async function deleteRate(db: Db, workspaceId: string, id: string): Promise<void> {
  const rows = await db
    .delete(rates)
    .where(and(eq(rates.workspaceId, workspaceId), eq(rates.id, id)))
    .returning({ id: rates.id })
  one(rows, 'rate')
}

/** Map a stored rate to the domain rule shape. */
export function toRule(r: Rate): ScopedRateRule {
  return {
    level: r.level as RateLevel,
    scopeId: r.scopeId,
    amountMinorPerHour: r.amountMinorPerHour,
    effectiveFrom: r.effectiveFrom.getTime(),
  }
}

// ── Cost computation ─────────────────────────────────────────────────────────

export interface CostResult {
  costMinor: number
  currencyCode: string
  entryCount: number
}

/**
 * Cost of a project's tracked time up to `asOf`: each entry is priced with the
 * rate in effect at *its own* start (task → project → client → workspace
 * precedence), summed by the deterministic core. Running entries are measured to
 * `asOf`; soft-deleted entries are excluded.
 */
export async function projectCost(
  db: Db,
  workspaceId: string,
  projectId: string,
  asOf: Date,
): Promise<CostResult> {
  const project = one(
    await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          eq(projects.id, projectId),
          isNull(projects.deletedAt),
        ),
      ),
    'project',
  )
  const currency = one(
    await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)),
    'workspace',
  ).currencyCode

  const allRules = (await listRates(db, workspaceId)).map(toRule)
  const entries = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, workspaceId),
        eq(timeEntries.projectId, projectId),
        isNull(timeEntries.deletedAt),
      ),
    )

  const asOfMs = asOf.getTime()
  const costs = entries.map(e => {
    const startMs = e.startedAt.getTime()
    const rate = rateForEntry(
      allRules,
      { projectId, clientId: project.clientId, taskId: e.taskId },
      startMs,
    )
    if (rate === null) return 0
    const duration = entryDuration(
      {
        id: e.id,
        start: startMs,
        end: e.endedAt ? e.endedAt.getTime() : null,
        billable: e.billable,
        source: e.source,
      },
      asOfMs,
    )
    return costOf(rate, duration)
  })

  return { costMinor: sumMoney(costs), currencyCode: currency, entryCount: entries.length }
}

export interface ProjectBillable {
  projectId: string
  costMinor: number
}
export interface BillingSummary {
  billableMinor: number
  currencyCode: string
  byProject: ProjectBillable[]
}

/**
 * Billable revenue over a window (REQ-005): each **billable** entry that started
 * in `[from, to)` is priced with the rate in effect at its start (task → project
 * → client → workspace precedence) and summed per project and overall. The
 * windowed counterpart of `projectCost` that the Reports screen reads; running
 * entries are measured to `asOf`, unassigned/non-billable entries earn nothing.
 */
export async function billingSummary(
  db: Db,
  workspaceId: string,
  range: { from: Date; to: Date; asOf: Date },
): Promise<BillingSummary> {
  const currency = one(
    await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)),
    'workspace',
  ).currencyCode

  const clientByProject = new Map<string, string | null>()
  for (const p of await db
    .select({ id: projects.id, clientId: projects.clientId })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)))) {
    clientByProject.set(p.id, p.clientId)
  }

  const allRules = (await listRates(db, workspaceId)).map(toRule)
  const entries = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, workspaceId),
        isNull(timeEntries.deletedAt),
        gte(timeEntries.startedAt, range.from),
        lt(timeEntries.startedAt, range.to),
      ),
    )

  const asOfMs = range.asOf.getTime()
  const costsByProject = new Map<string, number[]>()
  for (const e of entries) {
    if (!e.billable || e.projectId === null) continue
    const clientId = clientByProject.get(e.projectId) ?? null
    const rate = rateForEntry(
      allRules,
      { projectId: e.projectId, clientId, taskId: e.taskId },
      e.startedAt.getTime(),
    )
    if (rate === null) continue
    const duration = entryDuration(
      {
        id: e.id,
        start: e.startedAt.getTime(),
        end: e.endedAt ? e.endedAt.getTime() : null,
        billable: e.billable,
        source: e.source,
      },
      asOfMs,
    )
    const list = costsByProject.get(e.projectId) ?? []
    list.push(costOf(rate, duration))
    costsByProject.set(e.projectId, list)
  }

  const byProject = [...costsByProject.entries()]
    .map(([projectId, costs]) => ({ projectId, costMinor: sumMoney(costs) }))
    .sort((a, b) => b.costMinor - a.costMinor || a.projectId.localeCompare(b.projectId))

  return {
    billableMinor: sumMoney(byProject.map(p => p.costMinor)),
    currencyCode: currency,
    byProject,
  }
}

// ── Budgets ──────────────────────────────────────────────────────────────────

export interface BudgetInput {
  scope: (typeof BUDGET_SCOPES)[number]
  scopeId: string
  basis: (typeof BUDGET_BASES)[number]
  limitAmount: number
  period: (typeof BUDGET_PERIODS)[number]
  thresholds?: number[] | undefined
}

export async function createBudget(
  db: Db,
  workspaceId: string,
  input: BudgetInput,
): Promise<BudgetRow> {
  if (!BUDGET_SCOPES.includes(input.scope)) throw new ValidationError('invalid budget scope')
  if (!BUDGET_BASES.includes(input.basis)) throw new ValidationError('invalid budget basis')
  if (!BUDGET_PERIODS.includes(input.period)) throw new ValidationError('invalid budget period')
  assertMinorInt(input.limitAmount, 'budget limit')
  const rows = await db
    .insert(budgets)
    .values({
      workspaceId,
      scope: input.scope,
      scopeId: input.scopeId,
      basis: input.basis,
      limitAmount: input.limitAmount,
      period: input.period,
      thresholds: input.thresholds ?? [0.8, 1],
    })
    .returning()
  return one(rows, 'budget')
}

export function listBudgets(db: Db, workspaceId: string): Promise<BudgetRow[]> {
  return db.select().from(budgets).where(eq(budgets.workspaceId, workspaceId))
}

export async function getBudget(db: Db, workspaceId: string, id: string): Promise<BudgetRow> {
  return one(
    await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.workspaceId, workspaceId), eq(budgets.id, id))),
    'budget',
  )
}

export async function deleteBudget(db: Db, workspaceId: string, id: string): Promise<void> {
  const rows = await db
    .delete(budgets)
    .where(and(eq(budgets.workspaceId, workspaceId), eq(budgets.id, id)))
    .returning({ id: budgets.id })
  one(rows, 'budget')
}

function toCoreBudget(b: BudgetRow): CoreBudget {
  return {
    basis: b.basis as CoreBudget['basis'],
    limit: b.limitAmount,
    period: b.period as CoreBudget['period'],
    thresholds: b.thresholds,
  }
}

/** How much of a budget's unit its scope has consumed this period. */
async function consumedFor(
  db: Db,
  workspaceId: string,
  budget: BudgetRow,
  asOf: Date,
): Promise<number> {
  // Only project-scoped consumption is computed at 1.0 (client roll-up is backlog).
  if (budget.scope !== 'project') return 0
  if (budget.basis === 'money') {
    return (await projectCost(db, workspaceId, budget.scopeId, asOf)).costMinor
  }
  const entries = await db
    .select({ startedAt: timeEntries.startedAt, endedAt: timeEntries.endedAt })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, workspaceId),
        eq(timeEntries.projectId, budget.scopeId),
        isNull(timeEntries.deletedAt),
      ),
    )
  const asOfMs = asOf.getTime()
  return entries.reduce((total, e) => {
    const end = e.endedAt ? e.endedAt.getTime() : asOfMs
    return total + Math.max(0, end - e.startedAt.getTime())
  }, 0)
}

/**
 * Consumption **as of** an instant, with each entry clamped to `[start, min(asOf, end)]`
 * and entries not yet started excluded — a genuine point-in-time value for the burn-down
 * curve (unlike `consumedFor`, which counts a completed entry's full duration the moment it
 * exists). Reuses the same effective-dated rate math (`rateForEntry`/`costOf`) for money.
 */
async function consumedAsOf(
  db: Db,
  workspaceId: string,
  budget: BudgetRow,
  asOf: Date,
): Promise<number> {
  if (budget.scope !== 'project') return 0
  const asOfMs = asOf.getTime()
  const entries = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, workspaceId),
        eq(timeEntries.projectId, budget.scopeId),
        isNull(timeEntries.deletedAt),
      ),
    )
  const clamped = (e: (typeof entries)[number]): number => {
    const startMs = e.startedAt.getTime()
    if (startMs >= asOfMs) return 0 // not started yet at this instant
    const endMs = e.endedAt ? Math.min(e.endedAt.getTime(), asOfMs) : asOfMs
    return Math.max(0, endMs - startMs)
  }
  if (budget.basis !== 'money') {
    return entries.reduce((total, e) => total + clamped(e), 0)
  }
  const project = await getBudgetProject(db, workspaceId, budget.scopeId)
  const rules = (await listRates(db, workspaceId)).map(toRule)
  const costs = entries.map(e => {
    const dur = clamped(e)
    if (dur === 0) return 0
    const rate = rateForEntry(
      rules,
      { projectId: budget.scopeId, clientId: project.clientId, taskId: e.taskId },
      e.startedAt.getTime(),
    )
    return rate === null ? 0 : costOf(rate, dur)
  })
  return sumMoney(costs)
}

/** The project row a project-scoped budget points at (for the client id in rate lookup). */
async function getBudgetProject(
  db: Db,
  workspaceId: string,
  projectId: string,
): Promise<{ clientId: string | null }> {
  return one(
    await db
      .select({ clientId: projects.clientId })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId))),
    'project',
  )
}

export interface BudgetStatusResult {
  budget: BudgetRow
  status: BudgetStatus
  currencyCode: string
}

/** Read-only budget status — computes consumption and thresholds, persists nothing. */
export async function budgetStatusFor(
  db: Db,
  workspaceId: string,
  id: string,
  asOf: Date,
): Promise<BudgetStatusResult> {
  const budget = await getBudget(db, workspaceId, id)
  const consumed = await consumedFor(db, workspaceId, budget, asOf)
  const status = budgetStatus(toCoreBudget(budget), consumed)
  const currency = one(
    await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)),
    'workspace',
  ).currencyCode
  return { budget, status, currencyCode: currency }
}

export interface BudgetBurndownPoint {
  /** Sample instant. */
  at: Date
  /** Cumulative consumed as of that instant, in the budget's basis unit (ms or minor). */
  consumed: number
}

export interface BudgetBurndownResult {
  budget: BudgetRow
  currencyCode: string
  points: BudgetBurndownPoint[]
}

/**
 * The budget's cumulative-consumption trajectory (REQ-005) — the burn-down curve. Samples
 * the SAME as-of consumption `budgetStatusFor` uses at `points` evenly-spaced instants from
 * `from` to `to`, so every value is the deterministic core's, never a stored series. The
 * client extrapolates the projection from these points (`burndownProjection`).
 */
export async function budgetBurndownFor(
  db: Db,
  workspaceId: string,
  id: string,
  opts: { from: Date; to: Date; points: number },
): Promise<BudgetBurndownResult> {
  const budget = await getBudget(db, workspaceId, id)
  const currency = one(
    await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)),
    'workspace',
  ).currencyCode
  const n = Math.max(2, Math.min(30, Math.trunc(opts.points)))
  const fromMs = opts.from.getTime()
  const toMs = opts.to.getTime()
  const span = Math.max(0, toMs - fromMs)
  const sampled = await Promise.all(
    Array.from({ length: n }, (_v, i) => {
      const at = new Date(fromMs + Math.round((span * i) / (n - 1)))
      return consumedAsOf(db, workspaceId, budget, at).then(consumed => ({ at, consumed }))
    }),
  )
  return { budget, currencyCode: currency, points: sampled }
}

export interface BudgetEvaluation extends BudgetStatusResult {
  evaluation: ThresholdEvaluation
}

/**
 * Evaluate a budget and persist the outcome: newly crossed thresholds are
 * written to `budget_alerts` (the notification outbox) and the fired set is
 * updated with hysteresis, so an alert never flaps.
 */
export async function evaluateBudget(
  db: Db,
  workspaceId: string,
  id: string,
  asOf: Date,
): Promise<BudgetEvaluation> {
  return db.transaction(async tx => {
    const budget = await getBudget(tx, workspaceId, id)
    const consumed = await consumedFor(tx, workspaceId, budget, asOf)
    const status = budgetStatus(toCoreBudget(budget), consumed)
    const evaluation = evaluateThresholds(budget.thresholds, status.ratio, budget.firedThresholds)

    if (evaluation.toFire.length > 0) {
      await tx.insert(budgetAlerts).values(
        evaluation.toFire.map(threshold => ({
          workspaceId,
          budgetId: budget.id,
          threshold,
          ratioBps: Math.round(status.ratio * 10000),
        })),
      )
    }
    if (evaluation.toFire.length > 0 || evaluation.toClear.length > 0) {
      await tx
        .update(budgets)
        .set({ firedThresholds: [...evaluation.fired], updatedAt: new Date() })
        .where(and(eq(budgets.workspaceId, workspaceId), eq(budgets.id, id)))
    }
    const currency = one(
      await tx.select().from(workspaces).where(eq(workspaces.id, workspaceId)),
      'workspace',
    ).currencyCode
    return { budget, status, currencyCode: currency, evaluation }
  })
}
