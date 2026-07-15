/**
 * Focus streak + workload balance (REQ-032, ADR-0012) — deterministic wellbeing/
 * insight signals over real tracked time (ADR-0005: pure, no I/O, no clock). The
 * balance signal is a **neutral workload metric**, never a diagnosis: it compares
 * actual to target, nothing more (design "Balance-Feature-Ethik").
 */

/** One calendar day's focus, in the user's timezone; the list is ordered oldest→newest. */
export interface DayFocus {
  /** ISO date `YYYY-MM-DD` in the user's timezone. */
  readonly date: string
  /** Total tracked minutes booked on that day. */
  readonly focusMin: number
  /** A full absence (vacation/sick/holiday): it bridges a streak but never counts. */
  readonly absence: boolean
}

export interface StreakOptions {
  /** A day extends the streak at ≥ this many focus minutes (default 120 = 2 h). */
  readonly thresholdMin?: number
}

const DEFAULT_THRESHOLD_MIN = 120

/**
 * The current focus streak: the run of most-recent days meeting the focus threshold.
 * Absence days are transparent — they bridge the run without breaking it and without
 * adding to it (F17: "a streak that absences don't break"). The single most-recent
 * day, if it hasn't met the threshold yet and isn't an absence, is treated as "today
 * in progress" and ignored, so an unfinished today never resets yesterday's streak.
 */
export function focusStreak(days: readonly DayFocus[], opts: StreakOptions = {}): number {
  const threshold = opts.thresholdMin ?? DEFAULT_THRESHOLD_MIN
  let i = days.length - 1

  // Grace for an unfinished "today": skip the most-recent day once when it neither
  // qualifies nor is an absence. Only the last day gets this.
  const last = days[i]
  if (last !== undefined && !last.absence && last.focusMin < threshold) i -= 1

  let streak = 0
  for (; i >= 0; i -= 1) {
    const day = days[i]
    if (day === undefined) break
    if (day.absence) continue // bridge: no break, no add
    if (day.focusMin >= threshold) streak += 1
    else break
  }
  return streak
}

export type LoadLevel = 'calm' | 'steady' | 'elevated'

export interface LoadInput {
  /** Actual tracked/worked minutes in the window. */
  readonly actualMin: number
  /** Target minutes for the window (from the schedule); ≤ 0 means unknown. */
  readonly targetMin: number
}

export interface Load {
  readonly level: LoadLevel
  /** `actualMin / targetMin`, or `null` when the target is unknown. */
  readonly ratio: number | null
  readonly actualMin: number
  readonly targetMin: number
}

/** Below this share of target the week reads as light; at/around target it is steady. */
const CALM_BELOW = 0.75
/** Above this share of target the week reads as elevated load. */
const ELEVATED_ABOVE = 1.15

/**
 * Classify workload for a window as a neutral three-value signal (calm / steady /
 * elevated) from actual-vs-target — never a judgement of the person, only of the
 * hours. With no known target the level is `steady` and the ratio is `null` (we
 * don't guess). This is the deterministic input to the "Balance" chip; the AI may
 * later explain it, but the number is code's (ADR-0005).
 */
export function workloadLoad(input: LoadInput): Load {
  const { actualMin, targetMin } = input
  if (targetMin <= 0) {
    return { level: 'steady', ratio: null, actualMin, targetMin }
  }
  const ratio = actualMin / targetMin
  const level: LoadLevel =
    ratio < CALM_BELOW ? 'calm' : ratio > ELEVATED_ABOVE ? 'elevated' : 'steady'
  return { level, ratio, actualMin, targetMin }
}
