import {
  budgetStatus,
  type BudgetBasis,
  type BudgetPeriod,
  type BudgetStatus,
} from '../budgets/budget.js'
import { costOf, sumMoney, type Money } from '../budgets/money.js'
import { rateForEntry, type ScopedRateRule } from '../budgets/pricing.js'
import { entryDuration, type TimeEntry } from '../tracking/time-entry.js'
import type { Instant } from '../tracking/time.js'

/**
 * The money layer of the Reports read model (REQ-005, ADR-0005) as pure,
 * exhaustively tested functions — the deterministic counterpart of the server's
 * `billing` service, so the **offline** client computes exactly the same figures
 * from its local store instead of fabricating them. Every amount stays integer
 * minor units; the precedence rule lives once in `rateForEntry`.
 *
 * `clientByProject` supplies each project's client id (for client-level rates);
 * a running entry is measured to `asOf`.
 */

export interface ProjectCost {
  readonly projectId: string
  readonly costMinor: Money
}

export interface BillingBreakdown {
  readonly billableMinor: Money
  readonly byProject: readonly ProjectCost[]
}

/**
 * Billable revenue over a window: each **billable**, project-assigned entry is
 * priced with the rate in effect at its start and summed per project and overall,
 * most-billed first. Non-billable or unassigned entries earn nothing; an entry
 * whose chain has no rate in effect is skipped (unpriced). Mirrors the server's
 * `billingSummary`.
 */
export function priceBillableEntries(
  entries: readonly TimeEntry[],
  clientByProject: ReadonlyMap<string, string | null>,
  rates: readonly ScopedRateRule[],
  asOf: Instant,
): BillingBreakdown {
  const costsByProject = new Map<string, Money[]>()
  for (const e of entries) {
    if (!e.billable || e.projectId === undefined) continue
    const rate = rateForEntry(
      rates,
      {
        projectId: e.projectId,
        clientId: clientByProject.get(e.projectId) ?? null,
        taskId: e.taskId ?? null,
      },
      e.start,
    )
    if (rate === null) continue
    const list = costsByProject.get(e.projectId) ?? []
    list.push(costOf(rate, entryDuration(e, asOf)))
    costsByProject.set(e.projectId, list)
  }
  const byProject = [...costsByProject.entries()]
    .map(([projectId, costs]) => ({ projectId, costMinor: sumMoney(costs) }))
    .sort((a, b) => b.costMinor - a.costMinor || a.projectId.localeCompare(b.projectId))
  return { billableMinor: sumMoney(byProject.map(p => p.costMinor)), byProject }
}

export interface BudgetLimit {
  readonly id: string
  /** 'project' | 'client'. Only project-scoped consumption is computed (client roll-up is backlog). */
  readonly scope: string
  readonly scopeId: string
  readonly basis: BudgetBasis
  /** Cap in the basis's own unit: milliseconds for `hours`, minor units for `money`. */
  readonly limit: number
  readonly period: BudgetPeriod
  readonly thresholds: readonly number[]
}

export interface BudgetConsumption {
  readonly budget: BudgetLimit
  readonly status: BudgetStatus
}

/**
 * A project budget's consumption from **all** its entries (budgets are lifetime,
 * not windowed): money budgets price every entry, hours budgets sum every
 * duration. Non-project scopes consume 0. Mirrors the server's `consumedFor`.
 */
function consumedFor(
  budget: BudgetLimit,
  allEntries: readonly TimeEntry[],
  clientByProject: ReadonlyMap<string, string | null>,
  rates: readonly ScopedRateRule[],
  asOf: Instant,
): number {
  if (budget.scope !== 'project') return 0
  const projectEntries = allEntries.filter(e => e.projectId === budget.scopeId)
  if (budget.basis === 'money') {
    const clientId = clientByProject.get(budget.scopeId) ?? null
    const costs = projectEntries.map(e => {
      const rate = rateForEntry(
        rates,
        { projectId: budget.scopeId, clientId, taskId: e.taskId ?? null },
        e.start,
      )
      return rate === null ? 0 : costOf(rate, entryDuration(e, asOf))
    })
    return sumMoney(costs)
  }
  return projectEntries.reduce((total, e) => total + entryDuration(e, asOf), 0)
}

/** Status (consumption, ratio, reached thresholds) for each budget, input order preserved. */
export function budgetConsumptions(
  budgets: readonly BudgetLimit[],
  allEntries: readonly TimeEntry[],
  clientByProject: ReadonlyMap<string, string | null>,
  rates: readonly ScopedRateRule[],
  asOf: Instant,
): BudgetConsumption[] {
  return budgets.map(budget => ({
    budget,
    status: budgetStatus(
      {
        basis: budget.basis,
        limit: budget.limit,
        period: budget.period,
        thresholds: budget.thresholds,
      },
      consumedFor(budget, allEntries, clientByProject, rates, asOf),
    ),
  }))
}
