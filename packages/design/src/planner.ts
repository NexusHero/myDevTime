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
