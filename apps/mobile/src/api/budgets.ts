import { getJson } from './http.js'
import { num, numberArray, parseArray, record, str } from './parse.js'

/**
 * The budgets read model for the client (REQ-005): parse the `billing` module's
 * budget list and per-budget status (consumption, ratio and thresholds computed
 * by the deterministic core) and join them into ring rows for the Reports screen.
 * Parsing and the join are pure and tested; the numbers stay exactly as the
 * server computed them (ADR-0005). Only project-scoped budgets become rings —
 * client roll-up consumption is backlog on the server.
 */
export interface Budget {
  readonly id: string
  readonly scope: string
  readonly scopeId: string
  readonly basis: string
  readonly limitAmount: number
  readonly period: string
}

export function parseBudget(value: unknown): Budget {
  const o = record(value)
  return {
    id: str(o, 'id'),
    scope: str(o, 'scope'),
    scopeId: str(o, 'scopeId'),
    basis: str(o, 'basis'),
    limitAmount: num(o, 'limitAmount'),
    period: str(o, 'period'),
  }
}

export interface BudgetStatus {
  readonly consumed: number
  readonly limit: number
  readonly ratio: number
  readonly remaining: number
  readonly reached: number[]
}
export interface BudgetStatusResult {
  readonly budget: Budget
  readonly status: BudgetStatus
  readonly currencyCode: string
}

export function parseBudgetStatus(value: unknown): BudgetStatusResult {
  const o = record(value)
  const s = record(o.status)
  return {
    budget: parseBudget(o.budget),
    status: {
      consumed: num(s, 'consumed'),
      limit: num(s, 'limit'),
      ratio: num(s, 'ratio'),
      remaining: num(s, 'remaining'),
      reached: numberArray(s.reached),
    },
    currencyCode: str(o, 'currencyCode'),
  }
}

/** List the workspace's budgets. */
export async function fetchBudgets(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Budget[]> {
  return parseArray(await getJson(baseUrl, '/api/billing/budgets', fetchImpl), parseBudget)
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
export interface BurndownSample {
  readonly atMs: number
  readonly consumed: number
}
export interface BudgetBurndownData {
  readonly budget: Budget
  readonly currencyCode: string
  readonly points: BurndownSample[]
}

export function parseBudgetBurndown(value: unknown): BudgetBurndownData {
  const o = record(value)
  return {
    budget: parseBudget(o.budget),
    currencyCode: str(o, 'currencyCode'),
    points: parseArray(o.points, p => {
      const r = record(p)
      return { atMs: Date.parse(str(r, 'at')), consumed: num(r, 'consumed') }
    }),
  }
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
