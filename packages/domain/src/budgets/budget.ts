import type { DurationMs, Instant } from '../tracking/time.js'
import { DAY_MS } from '../tracking/time.js'

/**
 * Budget consumption, threshold alerts, and deadline proximity (REQ-005) — all
 * deterministic and pure (ADR-0005). Amounts stay integer; ratios are float
 * because they are for comparison and display, never a persisted money value.
 */

export type BudgetBasis = 'hours' | 'money'
export type BudgetPeriod = 'total' | 'monthlyRecurring'

export interface Budget {
  readonly basis: BudgetBasis
  /**
   * The cap, in the basis's own unit: **milliseconds** for `hours`, **integer
   * minor units** for `money`. (Hours use ms so the tracking core's exact
   * durations flow straight in without a lossy conversion.)
   */
  readonly limit: number
  readonly period: BudgetPeriod
  /** Alert ratios in (0, ∞), e.g. `[0.8, 1]`. */
  readonly thresholds: readonly number[]
}

export interface BudgetStatus {
  readonly consumed: number
  readonly limit: number
  /** consumed / limit; 0 when the limit is 0 (an unset budget never alerts). */
  readonly ratio: number
  /** limit − consumed; negative once over budget. */
  readonly remaining: number
  /** Thresholds the current ratio has reached, ascending. */
  readonly reached: readonly number[]
}

/** Status of a budget given how much of its unit has been consumed this period. */
export function budgetStatus(budget: Budget, consumed: number): BudgetStatus {
  const ratio = budget.limit > 0 ? consumed / budget.limit : 0
  const reached = [...budget.thresholds].filter(t => ratio >= t).sort((a, b) => a - b)
  return { consumed, limit: budget.limit, ratio, remaining: budget.limit - consumed, reached }
}

/** Sum durations for an hours-based budget's consumption. */
export function consumedDuration(durations: readonly DurationMs[]): DurationMs {
  return durations.reduce((a, b) => a + b, 0)
}

/** One sample of a budget's cumulative consumption over time (the burn-down curve). */
export interface BurndownPoint {
  /** Sample instant (ms epoch). */
  readonly at: Instant
  /** Cumulative consumed at that instant, in the budget's basis unit (ms or minor). */
  readonly consumed: number
}

export interface BurndownProjection {
  /** Consumption rate in the basis unit per millisecond over the sampled span (≥ 0). */
  readonly ratePerMs: number
  /**
   * Projected instant the limit is reached if the recent rate holds, or null when it
   * won't be — a flat/declining trajectory, an unset limit, or already at/over budget.
   */
  readonly exhaustsAt: Instant | null
  /** True once the latest sample is at or over the limit. */
  readonly over: boolean
}

/**
 * Project when a budget runs out from its recent burn-down (REQ-005). The rate is the
 * average slope across the sampled span (never negative — a budget's cumulative
 * consumption only rises), and the exhaustion instant extrapolates the latest sample at
 * that rate. Returns no projection when the trajectory is flat, the limit is unset, or
 * the budget is already spent — never false precision. Pure (ADR-0005); the sampling of
 * the points themselves is the caller's (the server computes consumption as-of each date).
 */
export function burndownProjection(
  points: readonly BurndownPoint[],
  limit: number,
): BurndownProjection {
  const first = points[0]
  const last = points[points.length - 1]
  const over = limit > 0 && last !== undefined && last.consumed >= limit
  if (first === undefined || last === undefined || points.length < 2) {
    return { ratePerMs: 0, exhaustsAt: null, over }
  }
  const spanMs = last.at - first.at
  const delta = last.consumed - first.consumed
  const ratePerMs = spanMs > 0 && delta > 0 ? delta / spanMs : 0
  const exhaustsAt =
    !over && ratePerMs > 0 && limit > 0 ? last.at + (limit - last.consumed) / ratePerMs : null
  return { ratePerMs, exhaustsAt, over }
}

// ── Threshold alerts with hysteresis (no flapping) ───────────────────────────

export interface ThresholdEvaluation {
  /** Thresholds newly crossed upward — emit an alert for each. */
  readonly toFire: readonly number[]
  /** Thresholds that dropped back below `t − hysteresis` — reset, may fire again. */
  readonly toClear: readonly number[]
  /** The new "already fired" set to persist for next time. */
  readonly fired: readonly number[]
}

/**
 * Decide which budget thresholds to alert on, given which already fired.
 * Hysteresis prevents flapping: a threshold that fired at, say, 0.80 won't fire
 * again until the ratio falls below `0.80 − hysteresis` and then climbs back.
 */
export function evaluateThresholds(
  thresholds: readonly number[],
  currentRatio: number,
  alreadyFired: readonly number[],
  hysteresis = 0.05,
): ThresholdEvaluation {
  const firedSet = new Set(alreadyFired)
  const toFire: number[] = []
  const toClear: number[] = []

  for (const t of thresholds) {
    const isFired = firedSet.has(t)
    if (!isFired && currentRatio >= t) toFire.push(t)
    else if (isFired && currentRatio < t - hysteresis) toClear.push(t)
  }
  for (const t of toFire) firedSet.add(t)
  for (const t of toClear) firedSet.delete(t)

  return {
    toFire: toFire.sort((a, b) => a - b),
    toClear: toClear.sort((a, b) => a - b),
    fired: [...firedSet].sort((a, b) => a - b),
  }
}

// ── Deadline proximity ───────────────────────────────────────────────────────

export interface DeadlineStatus {
  readonly overdue: boolean
  readonly msRemaining: number
  /** Whole days until the deadline (ceil); negative once overdue. */
  readonly daysRemaining: number
}

/** Proximity of `deadline` relative to `now`. Pure — the clock is an input. */
export function deadlineStatus(deadline: Instant, now: Instant): DeadlineStatus {
  const msRemaining = deadline - now
  return {
    overdue: msRemaining < 0,
    msRemaining,
    daysRemaining: Math.ceil(msRemaining / DAY_MS),
  }
}

/** True when the (non-overdue) deadline is within `days` — for “due soon” chips. */
export function isDueWithin(deadline: Instant, now: Instant, days: number): boolean {
  const { msRemaining } = deadlineStatus(deadline, now)
  return msRemaining >= 0 && msRemaining <= days * DAY_MS
}
