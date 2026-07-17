import type { Money } from '../budgets/money.js'

/**
 * Plan-vs-realized revenue (REQ-061, design v17 §K4) — pure and deterministic (ADR-0005).
 * A fixed-fee project has a **calculated (planned)** revenue and a **realized** revenue (what
 * the tracked work actually earns). The Reports "Plan ±x%" chip is exactly this comparison —
 * the number is code's; the client only colours and labels it. The Clockify Expected/Realized
 * benchmark, kept honest: no AI, no forecast, just two figures and their gap.
 */

/** Where realized revenue sits relative to plan. Tone is the client's call. */
export type VarianceStatus = 'under' | 'on' | 'over'

export interface PlanVariance {
  readonly planMinor: Money
  readonly realizedMinor: Money
  /** `realized − plan`, integer minor units. */
  readonly deltaMinor: Money
  /** `(realized − plan) / plan × 100`, rounded; `null` when the plan is 0 (undefined %). */
  readonly variancePct: number | null
  readonly status: VarianceStatus
}

/**
 * Compare realized revenue to the plan. Within `tolerancePct` (default 2 %) of the plan the
 * status is `on`; beyond it, `over` (realized above plan) or `under`. With a zero plan there is
 * no percentage, and the status follows the sign of the realized amount.
 */
export function planVsRealized(
  planMinor: Money,
  realizedMinor: Money,
  opts: { readonly tolerancePct?: number } = {},
): PlanVariance {
  const tolerance = Math.max(0, opts.tolerancePct ?? 2)
  const deltaMinor = realizedMinor - planMinor

  if (planMinor === 0) {
    const status: VarianceStatus = deltaMinor > 0 ? 'over' : deltaMinor < 0 ? 'under' : 'on'
    return { planMinor, realizedMinor, deltaMinor, variancePct: null, status }
  }

  const variancePct = Math.round((deltaMinor / planMinor) * 100)
  const status: VarianceStatus =
    Math.abs(variancePct) <= tolerance ? 'on' : variancePct > 0 ? 'over' : 'under'
  return { planMinor, realizedMinor, deltaMinor, variancePct, status }
}
