import type { Money } from '../budgets/money.js'
import { HOUR_MS, type DurationMs } from '../tracking/time.js'

/**
 * Effective-rate truth (REQ-048, ADR-0065 · design v13 G2) — the honest answer to
 * "what is an hour of my time actually worth?". The **nominal** rate is what you
 * charge on the hours you bill; the **effective** rate divides the same revenue by
 * **every** tracked hour — billable work, admin, meetings, the unbilled overrun — so
 * the number reflects reality, not the invoice. Pure integer math (ADR-0005): no
 * float ever touches an amount; the single division is exact in BigInt.
 */

export interface EffectiveRate {
  /** Total billable revenue over the window, in minor units. */
  readonly revenueMinor: Money
  /** Hours that were actually billed. */
  readonly billableMs: DurationMs
  /** All tracked hours in the window (billable + non-billable). */
  readonly trackedMs: DurationMs
  /** Revenue ÷ billable hours (what the invoice implies), or null with no billable time. */
  readonly nominalPerHourMinor: Money | null
  /** Revenue ÷ *all* tracked hours (the truth), or null with no tracked time. */
  readonly effectivePerHourMinor: Money | null
  /** Billable share of tracked time, 0..1 (0 when nothing tracked). */
  readonly utilization: number
}

/**
 * Exact per-hour rate: `revenueMinor ÷ (durationMs ÷ HOUR_MS)`, i.e.
 * `revenueMinor × HOUR_MS ÷ durationMs`, rounded half-up in BigInt. Null when the
 * duration is zero (no hours to divide by). Both inputs must be non-negative.
 */
export function perHourRate(revenueMinor: Money, durationMs: DurationMs): Money | null {
  if (!Number.isInteger(revenueMinor)) throw new Error('revenue must be an integer')
  if (!Number.isInteger(durationMs)) throw new Error('duration must be an integer')
  if (revenueMinor < 0) throw new Error('revenue must be non-negative')
  if (durationMs < 0) throw new Error('duration must be non-negative')
  if (durationMs === 0) return null

  const numerator = BigInt(revenueMinor) * BigInt(HOUR_MS)
  const divisor = BigInt(durationMs)
  const quotient = numerator / divisor
  const remainder = numerator % divisor
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient
  return Number(rounded)
}

/**
 * The effective-rate read model over a window. `revenueMinor` is the billable
 * revenue already priced by the deterministic finance layer; `billableMs` the hours
 * that earned it; `trackedMs` **all** tracked hours. Utilization exposes the gap the
 * effective rate quantifies.
 */
export function effectiveRate(
  revenueMinor: Money,
  billableMs: DurationMs,
  trackedMs: DurationMs,
): EffectiveRate {
  if (trackedMs < billableMs) throw new Error('trackedMs cannot be less than billableMs')
  return {
    revenueMinor,
    billableMs,
    trackedMs,
    nominalPerHourMinor: perHourRate(revenueMinor, billableMs),
    effectivePerHourMinor: perHourRate(revenueMinor, trackedMs),
    utilization: trackedMs === 0 ? 0 : billableMs / trackedMs,
  }
}
