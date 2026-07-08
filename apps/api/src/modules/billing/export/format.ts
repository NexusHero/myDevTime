import type { DurationMs } from '@mydevtime/domain'
import type { RoundingRule } from '@mydevtime/domain'

/**
 * Presentation helpers for exports. Amounts are integer minor units; these only
 * format for display and never re-compute a total (the numbers come from
 * `buildTimesheet`). CSV/XLSX stay locale-neutral in their bytes — hours as
 * decimal, money as `major.minor`, dates as ISO — because they are data formats;
 * human-facing locale formatting is the PDF's job (Phase C).
 */

const HOUR_MS = 3_600_000

/** Whole+fractional hours with two decimals, e.g. 5_400_000 → "1.50". */
export function hoursDecimal(ms: DurationMs): string {
  return (ms / HOUR_MS).toFixed(2)
}

/** Minor units → `major.minor` string (two minor digits at 1.0). */
export function moneyMajor(minor: number): string {
  const sign = minor < 0 ? '-' : ''
  const abs = Math.abs(minor)
  return `${sign}${String(Math.trunc(abs / 100))}.${String(abs % 100).padStart(2, '0')}`
}

/** Numeric hours/amounts for XLSX typed cells (real numbers, not strings). */
export function hoursNumber(ms: DurationMs): number {
  return ms / HOUR_MS
}
export function moneyNumber(minor: number): number {
  return minor / 100
}

/** `YYYY-MM-DD` in UTC — stable across environments. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Human label for the rounding profile embedded in every export (auditability). */
export function roundingLabel(rule: RoundingRule): string {
  return rule.mode === 'none' ? 'none' : `${rule.mode} / ${String(rule.incrementMinutes)} min`
}

/**
 * A line's effective rate in minor units per hour (amount ÷ hours), or null when
 * the line has no duration. Derived for display only — never a stored amount.
 */
export function effectiveRateMinor(amountMinor: number, ms: DurationMs): number | null {
  return ms > 0 ? Math.round((amountMinor * HOUR_MS) / ms) : null
}
