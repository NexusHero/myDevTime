import type { LocalDb, Row } from './port.js'
import { newId, nowIso } from './ids.js'

/**
 * Budget repository (REQ-005). Caps per project/client, workspace-scoped and
 * tombstone-aware; **no consumption math** (that is `packages/domain`'s job,
 * ADR-0005). Mirrors the server `budgets` table so the ADR-0019 sync engine
 * reconciles the same rows. `thresholds` is a JSON array in the store.
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

function parseThresholds(value: unknown): number[] {
  if (typeof value !== 'string') return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

function toBudget(row: Row): LocalBudget {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    scope: String(row.scope) as BudgetScope,
    scopeId: String(row.scope_id),
    basis: String(row.basis) as BudgetBasis,
    limitAmount: Number(row.limit_amount),
    period: String(row.period) as BudgetPeriod,
    thresholds: parseThresholds(row.thresholds),
  }
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
  const rows = await db.getAllAsync(
    `SELECT id, workspace_id, scope, scope_id, basis, limit_amount, period, thresholds
       FROM budgets
      WHERE workspace_id = ? AND deleted_at IS NULL
      ORDER BY created_at`,
    [workspaceId],
  )
  return rows.map(toBudget)
}

export async function createBudget(
  db: LocalDb,
  workspaceId: string,
  input: CreateBudgetInput,
): Promise<LocalBudget> {
  const id = input.id ?? newId()
  const now = nowIso()
  const thresholds = input.thresholds ?? [0.8, 1]
  await db.runAsync(
    `INSERT INTO budgets
       (id, workspace_id, scope, scope_id, basis, limit_amount, period, thresholds, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      workspaceId,
      input.scope,
      input.scopeId,
      input.basis,
      input.limitAmount,
      input.period,
      JSON.stringify(thresholds),
      now,
      now,
    ],
  )
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
