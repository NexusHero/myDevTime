import type { DurationMs } from '../tracking/time.js'
import { HOUR_MS } from '../tracking/time.js'

/**
 * Money on the deterministic path (REQ-005, ADR-0005). Amounts are **integer
 * minor units** (e.g. euro cents) — never a float. `Money` carries no currency;
 * a workspace has one currency at 1.0 (multi-currency is backlog), so the code
 * travels alongside as metadata, not inside every arithmetic value.
 *
 * The one place a division happens — turning a per-hour rate and a millisecond
 * duration into a cost — is done in BigInt so it is exact for any input, then
 * rounded by an explicit rule. No IEEE-754 rounding ever touches an amount.
 */

/** An amount in integer minor units. */
export type Money = number

/** How the sub-unit remainder of a cost division is resolved. */
export type MoneyRounding = 'round' | 'floor' | 'ceil'

function assertInt(n: number, what: string): void {
  if (!Number.isInteger(n)) throw new Error(`${what} must be an integer, got ${String(n)}`)
}

/**
 * Cost of `durationMs` at `rateMinorPerHour` (integer minor units per hour),
 * returned in minor units. Exact BigInt math; the remainder is resolved by
 * `mode` (default round-half-up). Both inputs must be non-negative integers.
 */
export function costOf(
  rateMinorPerHour: number,
  durationMs: DurationMs,
  mode: MoneyRounding = 'round',
): Money {
  assertInt(rateMinorPerHour, 'rate')
  assertInt(durationMs, 'duration')
  if (rateMinorPerHour < 0) throw new Error('rate must be non-negative')
  if (durationMs < 0) throw new Error('duration must be non-negative')

  const product = BigInt(rateMinorPerHour) * BigInt(durationMs)
  const divisor = BigInt(HOUR_MS)
  const quotient = product / divisor
  const remainder = product % divisor

  let result = quotient
  if (remainder > 0n) {
    if (mode === 'ceil') result = quotient + 1n
    else if (mode === 'round' && remainder * 2n >= divisor) result = quotient + 1n
  }
  return Number(result)
}

/** Sum of minor-unit amounts. Integer in, integer out. */
export function sumMoney(amounts: readonly Money[]): Money {
  let total = 0
  for (const a of amounts) {
    assertInt(a, 'amount')
    total += a
  }
  return total
}

/** Convert whole hours to a duration — for expressing hours-based budgets. */
export function hoursToMs(hours: number): DurationMs {
  return Math.round(hours * HOUR_MS)
}
