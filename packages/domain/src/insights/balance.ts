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

/**
 * The trailing focus trend as `weeks` weekly totals (focus minutes), oldest→newest —
 * the input to the Balance card's 10-week sparkline. Days are bucketed into 7-day
 * windows anchored on the **last** day in `days` (so the math is pure — no clock),
 * counting back; each bucket sums its days' focus minutes (absence days contribute
 * their `focusMin`, normally 0). Exactly `weeks` buckets are returned, zero-filled on
 * the left when the data is shorter, so the sparkline always has a stable width.
 * `days` is assumed ordered oldest→newest (as `focusStreak` consumes it).
 */
export function weeklyFocusTrend(days: readonly DayFocus[], weeks: number): number[] {
  const out = new Array<number>(Math.max(0, weeks)).fill(0)
  if (weeks <= 0 || days.length === 0) return out
  // Walk from the newest day backwards, filling the rightmost bucket first.
  let bucket = weeks - 1
  let inBucket = 0
  for (let i = days.length - 1; i >= 0 && bucket >= 0; i -= 1) {
    out[bucket] = (out[bucket] ?? 0) + (days[i]?.focusMin ?? 0)
    inBucket += 1
    if (inBucket === 7) {
      bucket -= 1
      inBucket = 0
    }
  }
  return out
}

/** A five-number summary of a day-length distribution, in focus minutes. */
export interface FocusQuartiles {
  readonly min: number
  readonly q1: number
  readonly median: number
  readonly q3: number
  readonly max: number
}

/** The value at fractional rank `p` (0…1) in an ascending list, linearly interpolated. */
function quantile(sorted: readonly number[], p: number): number {
  const n = sorted.length
  if (n === 1) return sorted[0] ?? 0
  const pos = p * (n - 1)
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  const lower = sorted[lo] ?? 0
  const upper = sorted[hi] ?? 0
  return lower + (upper - lower) * (pos - lo)
}

/**
 * The five-number summary (min / Q1 / median / Q3 / max) of **active** days' focus
 * minutes — the Balance card's day-length box plot. Absence days and days with no
 * tracked time are excluded (a day off is not a short work day), so the plot describes
 * the spread of days actually worked. Returns `null` when fewer than `minDays` (default
 * 4) active days exist, so the view shows an honest empty state instead of a box drawn
 * from too little data. Pure quartile math (linear interpolation), no clock, no I/O.
 */
export function dailyHoursDistribution(
  days: readonly DayFocus[],
  minDays = 4,
): FocusQuartiles | null {
  const active = days
    .filter(d => !d.absence && d.focusMin > 0)
    .map(d => d.focusMin)
    .sort((a, b) => a - b)
  if (active.length < minDays) return null
  return {
    min: active[0] ?? 0,
    q1: quantile(active, 0.25),
    median: quantile(active, 0.5),
    q3: quantile(active, 0.75),
    max: active[active.length - 1] ?? 0,
  }
}
