import { DAY_MS } from '../tracking/time.js'

/**
 * The absence core (REQ-029, ADR-0010): vacation / sick / holiday / custom leave
 * as inclusive calendar-date ranges, with half-day support, and the vacation
 * allowance balance. Pure and deterministic (ADR-0005) — dates are plain
 * `YYYY-MM-DD` calendar days (no clock, no zone), so day counting is exact and
 * timezone-independent. Target-hour interplay (crediting an absence day against
 * the work schedule) layers on where the overtime balance is computed.
 */

export type AbsenceKind = 'vacation' | 'sick' | 'holiday' | 'other'

export interface Absence {
  readonly kind: AbsenceKind
  /** Inclusive first calendar day, `YYYY-MM-DD`. */
  readonly startDate: string
  /** Inclusive last calendar day, `YYYY-MM-DD`. */
  readonly endDate: string
  /** A single-day absence taken as a half day (0.5); ignored on multi-day ranges. */
  readonly halfDay: boolean
}

/** Epoch day index (days since 1970-01-01 UTC) for a `YYYY-MM-DD` calendar date. */
function epochDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  if (y === undefined || m === undefined || d === undefined) return Number.NaN
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS)
}

/** Whole calendar days from `start` to `end` inclusive; 0 when `end` precedes `start`. */
export function inclusiveDayCount(start: string, end: string): number {
  const days = epochDay(end) - epochDay(start) + 1
  return Number.isFinite(days) && days > 0 ? days : 0
}

/** Days an absence spans; a single half-day counts 0.5, else the inclusive range. */
export function absenceDays(a: Absence): number {
  const days = inclusiveDayCount(a.startDate, a.endDate)
  if (a.halfDay && days === 1) return 0.5
  return days
}

/** Whether an absence covers a `YYYY-MM-DD` date (inclusive of both ends). */
export function coversDate(a: Absence, date: string): boolean {
  const day = epochDay(date)
  return day >= epochDay(a.startDate) && day <= epochDay(a.endDate)
}

export interface AbsencePolicy {
  readonly annualAllowanceDays: number
  readonly carryOverDays: number
}

export interface VacationBalance {
  readonly allowanceDays: number
  readonly carryOverDays: number
  readonly usedDays: number
  /** `allowance + carryOver − used`; negative once overdrawn. */
  readonly remainingDays: number
}

/** Vacation balance for a set of absences: only `vacation` days draw the allowance. */
export function vacationBalance(
  absences: readonly Absence[],
  policy: AbsencePolicy,
): VacationBalance {
  const usedDays = absences
    .filter(a => a.kind === 'vacation')
    .reduce((sum, a) => sum + absenceDays(a), 0)
  return {
    allowanceDays: policy.annualAllowanceDays,
    carryOverDays: policy.carryOverDays,
    usedDays,
    remainingDays: policy.annualAllowanceDays + policy.carryOverDays - usedDays,
  }
}
