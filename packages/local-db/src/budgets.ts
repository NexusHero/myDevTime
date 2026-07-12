import { and, eq, isNull } from 'drizzle-orm'
import type { LocalDb } from './port.js'
import { drizzleFor } from './db.js'
import { budgets } from './tables.js'
import { newId, nowIso } from './ids.js'

/**
 * Budget repository (REQ-005). Caps per project/client, workspace-scoped and
 * tombstone-aware; **no consumption math** (that is `packages/domain`'s job,
 * ADR-0005). Mirrors the server `budgets` table so the ADR-0019 sync engine
 * reconciles the same rows. `thresholds` is a JSON column (Drizzle parses it),
 * queried through Drizzle (ADR-0046).
 */
export type BudgetScope = 'project' | 'client'
export type BudgetBasis = 'hours' | 'money'
export type BudgetPeriod = 'total' | 'monthlyRecurring'

export interface LocalBudget {
  readonly id: string
  readonly workspaceId: string
  readonly scope: BudgetScope
  readonly scopeId: string
  readonly basis: BudgetBasis
  /** Cap in the basis's own unit: milliseconds for `hours`, minor units for `money`. */
  readonly limitAmount: number
  readonly period: BudgetPeriod
  readonly thresholds: number[]
}

const cols = {
  id: budgets.id,
  workspaceId: budgets.workspaceId,
  scope: budgets.scope,
  scopeId: budgets.scopeId,
  basis: budgets.basis,
  limitAmount: budgets.limitAmount,
  period: budgets.period,
  thresholds: budgets.thresholds,
}

export interface CreateBudgetInput {
  readonly scope: BudgetScope
  readonly scopeId: string
  readonly basis: BudgetBasis
  readonly limitAmount: number
  readonly period: BudgetPeriod
  readonly thresholds?: number[]
  readonly id?: string
}

/** All budgets in the workspace, by creation order. */
export async function listBudgets(db: LocalDb, workspaceId: string): Promise<LocalBudget[]> {
  return drizzleFor(db)
    .select(cols)
    .from(budgets)
    .where(and(eq(budgets.workspaceId, workspaceId), isNull(budgets.deletedAt)))
    .orderBy(budgets.createdAt)
}

export async function createBudget(
  db: LocalDb,
  workspaceId: string,
  input: CreateBudgetInput,
): Promise<LocalBudget> {
  const id = input.id ?? newId()
  const now = nowIso()
  const thresholds = input.thresholds ?? [0.8, 1]
  await drizzleFor(db).insert(budgets).values({
    id,
    workspaceId,
    scope: input.scope,
    scopeId: input.scopeId,
    basis: input.basis,
    limitAmount: input.limitAmount,
    period: input.period,
    thresholds,
    createdAt: now,
    updatedAt: now,
  })
  return {
    id,
    workspaceId,
    scope: input.scope,
    scopeId: input.scopeId,
    basis: input.basis,
    limitAmount: input.limitAmount,
    period: input.period,
    thresholds,
  }
}
