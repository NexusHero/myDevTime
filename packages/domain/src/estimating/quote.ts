import { costOf, type Money } from '../budgets/money.js'
import type { DurationMs } from '../tracking/time.js'

/**
 * Quote-from-history estimator (REQ-053, ADR-0065 · design v13 KI2) — the deterministic
 * half of the AI quote calculator. Given how long *similar past work* actually took, it
 * returns the honest distribution (median, quartiles, p90) and a buffered suggestion, so
 * a quote is grounded in the user's own history rather than a guess. The AI layer only
 * *phrases* this number (ADR-0005/0029); the math is here, pure and reproducible. Returns
 * null when there is no history — the caller then refuses honestly rather than inventing.
 */

export interface QuoteEstimate {
  readonly sampleSize: number
  readonly minMs: DurationMs
  readonly medianMs: DurationMs
  readonly p25Ms: DurationMs
  readonly p75Ms: DurationMs
  readonly p90Ms: DurationMs
  readonly maxMs: DurationMs
  /** The buffered suggestion (a chosen upper percentile, default p75). */
  readonly suggestedMs: DurationMs
  /** Suggested value priced at `ratePerHourMinor`, or null when no rate was given. */
  readonly suggestedMinor: Money | null
}

export interface QuoteOptions {
  /** Percentile (0..1) used for the buffered suggestion. Default 0.75. */
  readonly bufferPercentile?: number
  /** Billable rate, integer minor units per hour, to price the suggestion. */
  readonly ratePerHourMinor?: Money
}

/** Linear-interpolated percentile of a *sorted* ascending array. `p` in [0, 1]. */
function percentileSorted(sorted: readonly number[], p: number): number {
  const n = sorted.length
  if (n === 0) return 0
  if (n === 1) return sorted[0] ?? 0
  const rank = p * (n - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  const frac = rank - lo
  return Math.round((sorted[lo] ?? 0) * (1 - frac) + (sorted[hi] ?? 0) * frac)
}

/**
 * Estimate from a set of historical actual durations (ms). Non-finite and negative
 * samples are dropped. Returns null when nothing usable remains, so the AI never quotes
 * from thin air.
 */
export function estimateFromHistory(
  durationsMs: readonly number[],
  opts: QuoteOptions = {},
): QuoteEstimate | null {
  const clean = durationsMs.filter(d => Number.isFinite(d) && d >= 0).sort((a, b) => a - b)
  if (clean.length === 0) return null

  const buffer = Math.min(1, Math.max(0, opts.bufferPercentile ?? 0.75))
  const suggestedMs = percentileSorted(clean, buffer)
  const suggestedMinor =
    opts.ratePerHourMinor !== undefined ? costOf(opts.ratePerHourMinor, suggestedMs) : null

  return {
    sampleSize: clean.length,
    minMs: clean[0] ?? 0,
    medianMs: percentileSorted(clean, 0.5),
    p25Ms: percentileSorted(clean, 0.25),
    p75Ms: percentileSorted(clean, 0.75),
    p90Ms: percentileSorted(clean, 0.9),
    maxMs: clean[clean.length - 1] ?? 0,
    suggestedMs,
    suggestedMinor,
  }
}
