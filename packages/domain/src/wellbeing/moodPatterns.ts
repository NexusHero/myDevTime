/**
 * Weekday mood-pattern core (ADR-0071, REQ-068) — Sevi's mood-pattern awareness over the
 * consented mood memory. Pure and deterministic (ADR-0005): over a series of stored punch-out
 * moods it finds the weekdays that *repeatedly* run low, so the client can surface one calm
 * observation ("Tuesdays often tense") — an observation about days, never about the person
 * (the Balance-Feature ethic). The honesty rule is structural: a weekday may only read as a
 * pattern once it carries at least `minPerWeekday` of the person's own samples AND its median
 * mood score sits at/below the existing low-mood line (`LOW_MOOD_MAXIMUM` from `reviewDay`,
 * via the fixed `moodScoreOf` mapping). One bad day is never a pattern, and while no weekday
 * reaches the minimum the core answers `enoughData: false` with no flags — never judging early.
 * No clock, no I/O: the weekday arrives as data (`moodEntryOf` derives it clock-free from the
 * stored `'YYYY-MM-DD'` string, with the same UTC Sunday-0 convention the server's `weekdayOf`
 * uses, so client- and server-derived weekdays can never disagree).
 */

import type { Mood } from './mood.js'
import { moodScoreOf } from './mood.js'
import { LOW_MOOD_MAXIMUM } from './dayReview.js'

/** One stored mood day: the day, the weekday it fell on (0 = Sunday … 6 = Saturday), the word. */
export interface MoodPatternEntry {
  readonly day: string
  readonly weekday: number
  readonly mood: Mood
}

/** A weekday that repeatedly runs low: its index and the median mood score that flagged it. */
export interface LowMoodWeekday {
  readonly weekday: number
  readonly medianMood: number
}

export interface MoodPatterns {
  /** The flagged weekdays, ascending by weekday — deterministic regardless of input order. */
  readonly lowWeekdays: readonly LowMoodWeekday[]
  /** False while no weekday reaches the sample minimum — an honest "too early to tell". */
  readonly enoughData: boolean
}

/** A weekday needs at least this many stored moods before it may read as a pattern. */
export const MIN_WEEKDAY_MOOD_SAMPLES = 3

/**
 * Build a `MoodPatternEntry` from a stored mood day, deriving the weekday clock-free from the
 * `'YYYY-MM-DD'` string with the SAME convention as the server's `weekdayOf` (UTC,
 * 0 = Sunday … 6 = Saturday) — one convention, two ends, no drift.
 */
export function moodEntryOf(day: string, mood: Mood): MoodPatternEntry {
  return { day, weekday: new Date(`${day}T00:00:00Z`).getUTCDay(), mood }
}

/**
 * Median of a non-empty score list (sorted copy; even counts average the middle pair).
 * Only ever called with ≥1 score — a judged weekday bucket always holds samples.
 */
function median(scores: readonly number[]): number {
  const sorted = [...scores].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  // The middle element (odd count) or the middle pair (even count), averaged.
  const middle = sorted.slice(sorted.length % 2 === 1 ? mid : mid - 1, mid + 1)
  return middle.reduce((sum, x) => sum + x, 0) / middle.length
}

/**
 * The weekdays that repeatedly run low over `entries`. A weekday flags only when it holds at
 * least `minPerWeekday` samples AND the median of its mood scores (via the fixed `moodScoreOf`
 * mapping) is at/below the low-mood line. While no weekday reaches the minimum, the result is
 * `enoughData: false` with no flags — the core never judges early, and one bad day is never a
 * pattern. Flags come back ascending by weekday, independent of input order.
 */
export function moodPatterns(
  entries: readonly MoodPatternEntry[],
  minPerWeekday: number = MIN_WEEKDAY_MOOD_SAMPLES,
): MoodPatterns {
  const byWeekday = new Map<number, number[]>()
  for (const e of entries) {
    const bucket = byWeekday.get(e.weekday)
    const score = moodScoreOf(e.mood)
    if (bucket) bucket.push(score)
    else byWeekday.set(e.weekday, [score])
  }

  const judged = [...byWeekday.entries()].filter(([, scores]) => scores.length >= minPerWeekday)
  if (judged.length === 0) return { lowWeekdays: [], enoughData: false }

  const lowWeekdays: LowMoodWeekday[] = []
  for (const [weekday, scores] of judged.sort(([a], [b]) => a - b)) {
    const medianMood = median(scores)
    if (medianMood <= LOW_MOOD_MAXIMUM) lowWeekdays.push({ weekday, medianMood })
  }
  return { lowWeekdays, enoughData: true }
}
