import type { Instant } from './time.js'
import type { TimeEntry } from './time-entry.js'

/** What to do when entries overlap: surface a warning, or trim automatically. */
export type OverlapPolicy = 'warn' | 'auto-trim'

export interface OverlapConflict {
  readonly earlier: string
  readonly later: string
  readonly overlapStart: Instant
  readonly overlapEnd: Instant
}

/**
 * All overlapping pairs among completed entries (running entries have no end and
 * can't overlap). Intervals are half-open `[start, end)`, so touching at a
 * boundary is not an overlap.
 */
export function findOverlaps(entries: readonly TimeEntry[]): OverlapConflict[] {
  const completed = entries
    .filter((e): e is TimeEntry & { end: Instant } => e.end !== null)
    .sort((a, b) => a.start - b.start)
  const conflicts: OverlapConflict[] = []
  for (let i = 0; i < completed.length; i++) {
    const a = completed[i]
    if (!a) continue
    for (let j = i + 1; j < completed.length; j++) {
      const b = completed[j]
      if (!b) continue
      if (b.start >= a.end) break // sorted by start: nothing later can overlap `a`
      const overlapStart = Math.max(a.start, b.start)
      const overlapEnd = Math.min(a.end, b.end)
      if (overlapEnd > overlapStart) {
        conflicts.push({ earlier: a.id, later: b.id, overlapStart, overlapEnd })
      }
    }
  }
  return conflicts
}

/** True if any two completed entries overlap. */
export function hasOverlaps(entries: readonly TimeEntry[]): boolean {
  return findOverlaps(entries).length > 0
}

/**
 * Auto-trim policy: where a completed entry's end runs past the next entry's
 * start, shorten it to that start. Returns entries sorted by start; running
 * entries pass through untouched.
 */
export function autoTrimOverlaps(entries: readonly TimeEntry[]): TimeEntry[] {
  const sorted = entries.slice().sort((a, b) => a.start - b.start)
  const result: TimeEntry[] = []
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i]
    if (!e) continue
    const next = sorted[i + 1]
    if (e.end !== null && next && next.start > e.start && next.start < e.end) {
      result.push({ ...e, end: next.start })
    } else {
      result.push(e)
    }
  }
  return result
}

/**
 * Starting a new timer stops any entry still running at or before `newStart`
 * (one running timer at a time — REQ-003). Returns a new array.
 */
export function stopRunningAt(entries: readonly TimeEntry[], newStart: Instant): TimeEntry[] {
  return entries.map(e => (e.end === null && e.start <= newStart ? { ...e, end: newStart } : e))
}
