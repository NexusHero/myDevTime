/**
 * Planner geometry (ux-vision §3, issue #11) — pure layout math for the week
 * canvas, kept here (pure + tested) so the React Native screen stays declarative
 * and the numbers that place a block are deterministic (ADR-0005), exactly like
 * the instrument math in `instruments.ts`.
 *
 * A planner day is a fixed visible window of `spanMin` minutes (e.g. 08:00–18:00
 * → 600). A block starting at `startMin` for `lengthMin` minutes occupies a
 * vertical slice of that window; `plannerBlockRect` returns its `top` offset and
 * `height` as `[0, 1]` fractions of the window, clamped so a block that begins
 * before the window or runs past its end still renders sensibly (never negative,
 * never past 1).
 */

/** A block's placement within a day column, as `[0, 1]` fractions of the span. */
export interface BlockRect {
  /** Distance from the top of the day window, `0`–`1`. */
  readonly top: number
  /** Fraction of the day window the block covers, `0`–`1`. */
  readonly height: number
}

/**
 * Place a `[startMin, startMin + lengthMin)` block inside a `spanMin` window.
 * Start is clamped to the window; the end is clamped to the window and never
 * falls before the (clamped) start, so `height >= 0`.
 */
export function plannerBlockRect(startMin: number, lengthMin: number, spanMin: number): BlockRect {
  if (!(spanMin > 0)) throw new Error('spanMin must be positive')
  if (lengthMin < 0) throw new Error('lengthMin must not be negative')
  const start = Math.min(Math.max(startMin, 0), spanMin)
  const end = Math.min(Math.max(startMin + lengthMin, start), spanMin)
  return { top: start / spanMin, height: (end - start) / spanMin }
}

/** Total hours across a set of block lengths (minutes → hours), for day totals. */
export function plannerTotalHours(lengthsMin: readonly number[]): number {
  return lengthsMin.reduce((sum, m) => sum + m, 0) / 60
}

/**
 * Task priority (design v6 Monat/Jahr): P1 (highest) … P3 (lowest). Only *tasks*
 * carry a priority and count toward day load; *events* (holiday, company event,
 * info) never do — they are surfaced but weigh nothing (planner ground law).
 */
export type Priority = 1 | 2 | 3

/** The priority weight in the day-load sum: high priority weighs heavier. */
export function priorityWeight(prio: Priority): number {
  return prio === 1 ? 1.4 : prio === 2 ? 1 : 0.7
}

/** A planned task's contribution to day load: its priority and estimate in hours. */
export interface TaskLoad {
  readonly prio: Priority
  readonly estHours: number
}

/**
 * Prio-weighted day load in hours (design v6): each task's estimate scaled by its
 * priority weight, summed. Negative estimates are floored at 0 so a bad datum
 * can't pull the load down. This is the number the day's "Schwere" bar and the
 * month heat compare against the daily target (`soll`).
 */
export function dayLoad(tasks: readonly TaskLoad[]): number {
  return tasks.reduce((sum, t) => sum + Math.max(t.estHours, 0) * priorityWeight(t.prio), 0)
}

/** Load tone vs the daily target: idle (nothing), good (≤85%), warn (≤100%), crit (over). */
export type LoadTone = 'idle' | 'good' | 'warn' | 'crit'

export function loadTone(load: number, soll: number): LoadTone {
  if (!(load > 0)) return 'idle'
  if (!(soll > 0)) return 'crit'
  if (load <= soll * 0.85) return 'good'
  if (load <= soll) return 'warn'
  return 'crit'
}
