import { clamp } from '../util.js'
import {
  isoWeekday,
  localParts,
  startOfLocalDay,
  startOfNextLocalDay,
  type DurationMs,
  type Instant,
  type TimeZone,
} from '../tracking/time.js'

/**
 * The attendance work-day core (REQ-028, ADR-0010): net worked time per shift and
 * the overtime balance against a weekly target schedule. Deterministic and pure —
 * every work-time number that reaches the signable report, the statistics, or the
 * Reports gauge is computed here, never by an LLM (ADR-0005). Effective-dated
 * schedules, break-rule (ArbZG §4) checks, and absences layer on in later slices;
 * this slice is the punch-pair math and the overtime balance it feeds.
 */

/** A completed work-day punch pair: clock-in, clock-out, and total break time. */
export interface Shift {
  readonly start: Instant
  readonly end: Instant
  readonly breakMs: DurationMs
}

/** A shift is valid when it ends after it starts and its breaks fit inside it. */
export function isValidShift(shift: Shift): boolean {
  return (
    Number.isFinite(shift.start) &&
    Number.isFinite(shift.end) &&
    Number.isFinite(shift.breakMs) &&
    shift.end > shift.start &&
    shift.breakMs >= 0 &&
    shift.breakMs <= shift.end - shift.start
  )
}

/** Net worked milliseconds for a shift: gross span minus breaks, never negative. */
export function shiftNetMs(shift: Shift): DurationMs {
  const gross = shift.end - shift.start
  return clamp(gross - shift.breakMs, 0, gross)
}

/** Contracted target worked ms per ISO weekday, Monday first: `[Mon, …, Sun]`. */
export type WeeklyTarget = readonly [
  DurationMs,
  DurationMs,
  DurationMs,
  DurationMs,
  DurationMs,
  DurationMs,
  DurationMs,
]

/** Target worked ms for the local day containing `instant`. */
export function targetForDay(target: WeeklyTarget, instant: Instant, tz: TimeZone): DurationMs {
  const p = localParts(instant, tz)
  const weekday = isoWeekday(p.year, p.month, p.day) // 1 = Mon … 7 = Sun
  return target[weekday - 1] ?? 0
}

/** A half-open local window `[from, to)` over which to compute a balance. */
export interface OvertimeRange {
  readonly from: Instant
  readonly to: Instant
  readonly tz: TimeZone
}

export interface OvertimeBalance {
  /** Net worked ms across valid shifts whose start falls in the window. */
  readonly workedMs: DurationMs
  /** Summed daily target across every local day the window touches. */
  readonly targetMs: DurationMs
  /** `workedMs − targetMs`; negative means under target. */
  readonly balanceMs: number
}

/**
 * The overtime balance for a window: net worked time (shifts starting in
 * `[from, to)`) minus the summed weekday target of every local day the window
 * covers. Invalid shifts are skipped, not thrown on, so one bad punch pair never
 * corrupts a period's balance.
 */
export function computeOvertime(
  shifts: readonly Shift[],
  target: WeeklyTarget,
  range: OvertimeRange,
): OvertimeBalance {
  const { from, to, tz } = range

  let workedMs = 0
  for (const shift of shifts) {
    if (!isValidShift(shift)) continue
    if (shift.start >= from && shift.start < to) workedMs += shiftNetMs(shift)
  }

  let targetMs = 0
  for (
    let cursor = startOfLocalDay(from, tz);
    cursor < to;
    cursor = startOfNextLocalDay(cursor, tz)
  ) {
    targetMs += targetForDay(target, cursor, tz)
  }

  return { workedMs, targetMs, balanceMs: workedMs - targetMs }
}
