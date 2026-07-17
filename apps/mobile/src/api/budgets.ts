import { getJson } from './http.js'
import { z } from 'zod'

/**
 * The budgets read model for the client (REQ-005): parse the `billing` module's
 * budget list and per-budget status (consumption, ratio and thresholds computed
 * by the deterministic core) and join them into ring rows for the Reports screen.
 * Parsing and the join are pure and tested; the numbers stay exactly as the
 * server computed them (ADR-0005). Only project-scoped budgets become rings —
 * client roll-up consumption is backlog on the server.
 */
export const budgetSchema = z.object({
  id: z.string(),
  scope: z.string(),
  scopeId: z.string(),
  basis: z.string(),
  limitAmount: z.number(),
  period: z.string(),
})
export type Budget = z.infer<typeof budgetSchema>

export const budgetStatusSchema = z.object({
  consumed: z.number(),
  limit: z.number(),
  ratio: z.number(),
  remaining: z.number(),
  reached: z.array(z.number()),
})
export type BudgetStatus = z.infer<typeof budgetStatusSchema>

export const budgetStatusResultSchema = z.object({
  budget: budgetSchema,
  status: budgetStatusSchema,
  currencyCode: z.string(),
})
export type BudgetStatusResult = z.infer<typeof budgetStatusResultSchema>

export function parseBudget(value: unknown): Budget {
  return budgetSchema.parse(value)
}

export function parseBudgetStatus(value: unknown): BudgetStatusResult {
  return budgetStatusResultSchema.parse(value)
}

/** List the workspace's budgets. */
export async function fetchBudgets(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Budget[]> {
  const res = await getJson(baseUrl, '/api/billing/budgets', fetchImpl)
  return z.array(budgetSchema).parse(res)
}

/** Read-only status (consumption + thresholds) for one budget. */
export async function fetchBudgetStatus(
  baseUrl: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BudgetStatusResult> {
  return parseBudgetStatus(await getJson(baseUrl, `/api/billing/budgets/${id}/status`, fetchImpl))
}

/** One burn-down sample: an instant (ms epoch) and the cumulative consumption then. */
export const burndownSampleSchema = z.object({
  atMs: z.string().transform(s => Date.parse(s)),
  consumed: z.number(),
})
export type BurndownSample = z.infer<typeof burndownSampleSchema>

export const budgetBurndownDataSchema = z.object({
  budget: budgetSchema,
  currencyCode: z.string(),
  points: z
    .array(
      z.object({
        at: z.string(),
        consumed: z.number(),
      }),
    )
    .transform(pts => pts.map(p => ({ atMs: Date.parse(p.at), consumed: p.consumed }))),
})
export type BudgetBurndownData = z.infer<typeof budgetBurndownDataSchema>

export function parseBudgetBurndown(value: unknown): BudgetBurndownData {
  return budgetBurndownDataSchema.parse(value)
}

/** The cumulative-consumption trajectory (burn-down) for one budget over the default window. */
export async function fetchBudgetBurndown(
  baseUrl: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BudgetBurndownData> {
  return parseBudgetBurndown(
    await getJson(baseUrl, `/api/billing/budgets/${id}/burndown`, fetchImpl),
  )
}

const PROJECT_SCOPE = 'project'

export interface BudgetRingRow {
  readonly id: string
  readonly name: string
  readonly ratio: number
  readonly consumed: number
  readonly basis: string
  readonly currencyCode: string
}

/**
 * Join project-scoped budget statuses with project names into ring rows. Non-
 * project scopes are dropped (their consumption is not computed server-side yet);
 * an unknown project id falls back to the raw scope id.
 */
export function toBudgetRings(
  statuses: readonly BudgetStatusResult[],
  nameById: ReadonlyMap<string, string>,
): BudgetRingRow[] {
  return statuses
    .filter(s => s.budget.scope === PROJECT_SCOPE)
    .map(s => ({
      id: s.budget.id,
      name: nameById.get(s.budget.scopeId) ?? s.budget.scopeId,
      ratio: s.status.ratio,
      consumed: s.status.consumed,
      basis: s.budget.basis,
      currencyCode: s.currencyCode,
    }))
}
