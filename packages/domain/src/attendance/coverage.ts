import type { DurationMs, Instant } from '../tracking/time.js'
import { isValidShift, shiftNetMs, type Shift } from './worktime.js'

/**
 * Project-coverage reconciliation (REQ-028 follow-up, #149, ADR-0010): how much of
 * a work-day's on-the-clock time is actually booked to a project, deterministically
 * (ADR-0005). Reconciles the worked shift windows against the booked project-entry
 * intervals — the uncovered gap is worked-but-unbooked time, and bookings landing
 * outside any shift are reported separately. Pure interval math; the caller maps its
 * time entries to `BookedInterval`s (project entries only, running ones excluded).
 */

/** A half-open `[start, end)` interval of booked project time. */
export interface BookedInterval {
  readonly start: Instant
  readonly end: Instant
}

export interface CoverageReport {
  /** Gross union of the worked shift windows. */
  readonly workedSpanMs: DurationMs
  /** Net worked time (worked span minus breaks). */
  readonly workedNetMs: DurationMs
  /** Total break time across the shifts. */
  readonly breakMs: DurationMs
  /** Booked time overlapping the worked windows — the covered part. */
  readonly bookedWithinMs: DurationMs
  /** Booked time landing outside every worked window (booked-but-not-worked). */
  readonly bookedOutsideMs: DurationMs
  /** Worked window not covered by any booking — the reconciliation gap. */
  readonly uncoveredMs: DurationMs
  /** `bookedWithinMs / workedSpanMs`, or 0 when nothing was worked. */
  readonly coverageRatio: number
}

interface Interval {
  readonly start: Instant
  readonly end: Instant
}

/** Merge half-open intervals into sorted, non-overlapping runs (touching runs join). */
function merge(intervals: readonly Interval[]): Interval[] {
  const valid = intervals.filter(
    i => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start,
  )
  const sorted = [...valid].sort((a, b) => a.start - b.start)
  const out: Interval[] = []
  for (const cur of sorted) {
    const last = out[out.length - 1]
    if (last !== undefined && cur.start <= last.end) {
      if (cur.end > last.end) out[out.length - 1] = { start: last.start, end: cur.end }
    } else {
      out.push(cur)
    }
  }
  return out
}

function totalLength(intervals: readonly Interval[]): DurationMs {
  return intervals.reduce((sum, i) => sum + (i.end - i.start), 0)
}

/** Length of the intersection of two already-merged interval sets, via a two-pointer sweep. */
function intersectionLength(a: readonly Interval[], b: readonly Interval[]): DurationMs {
  let i = 0
  let j = 0
  let total = 0
  while (i < a.length && j < b.length) {
    const ai = a[i]
    const bj = b[j]
    if (ai === undefined || bj === undefined) break
    const lo = Math.max(ai.start, bj.start)
    const hi = Math.min(ai.end, bj.end)
    if (hi > lo) total += hi - lo
    if (ai.end < bj.end) i++
    else j++
  }
  return total
}

export function reconcileCoverage(
  shifts: readonly Shift[],
  bookings: readonly BookedInterval[],
): CoverageReport {
  const valid = shifts.filter(isValidShift)
  const workedWindows = merge(valid.map(s => ({ start: s.start, end: s.end })))
  const booked = merge(bookings)

  const workedSpanMs = totalLength(workedWindows)
  const breakMs = valid.reduce((sum, s) => sum + s.breakMs, 0)
  const workedNetMs = valid.reduce((sum, s) => sum + shiftNetMs(s), 0)
  const bookedTotalMs = totalLength(booked)
  const bookedWithinMs = intersectionLength(workedWindows, booked)
  const bookedOutsideMs = bookedTotalMs - bookedWithinMs
  const uncoveredMs = workedSpanMs - bookedWithinMs

  return {
    workedSpanMs,
    workedNetMs,
    breakMs,
    bookedWithinMs,
    bookedOutsideMs,
    uncoveredMs,
    coverageRatio: workedSpanMs === 0 ? 0 : bookedWithinMs / workedSpanMs,
  }
}
