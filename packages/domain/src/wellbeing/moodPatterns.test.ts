import { describe, expect, it } from 'vitest'
import { MIN_WEEKDAY_MOOD_SAMPLES, moodEntryOf, moodPatterns } from './moodPatterns.js'
import type { MoodPatternEntry } from './moodPatterns.js'
import type { Mood } from './mood.js'

/**
 * Table tests for the weekday mood-pattern core (ADR-0071, REQ-068). The binding rule under
 * test: a weekday may only read as a pattern once it carries enough of the person's own
 * samples AND its median mood sits at/below the low-mood line — one bad day is never a
 * pattern, and with no weekday at the minimum the core says "not enough data" rather than
 * judging early.
 */

/** A weekday-pinned entry without date arithmetic — the weekday is the datum under test. */
function entry(weekday: number, mood: Mood): MoodPatternEntry {
  return { day: `w${String(weekday)}`, weekday, mood }
}

describe('moodPatterns', () => {
  it('MoodPatterns_EmptyEntries_ReportsNotEnoughDataAndNoFlags', () => {
    expect(moodPatterns([])).toEqual({ lowWeekdays: [], enoughData: false })
  })

  it('MoodPatterns_EveryWeekdayBelowTheMinimum_NeverJudges', () => {
    // Two stressed Tuesdays are grim but below the 3-sample minimum — no verdict from thin data.
    const result = moodPatterns([entry(2, 'stressed'), entry(2, 'stressed')])
    expect(result).toEqual({ lowWeekdays: [], enoughData: false })
  })

  it('MoodPatterns_OneBadDay_IsNeverAPattern', () => {
    // Tuesday has enough samples (so enoughData is true), but Friday's single stressed day
    // stays below the per-weekday minimum — one bad day never becomes a pattern.
    const result = moodPatterns([
      entry(2, 'good'),
      entry(2, 'good'),
      entry(2, 'good'),
      entry(5, 'stressed'),
    ])
    expect(result.enoughData).toBe(true)
    expect(result.lowWeekdays).toEqual([])
  })

  it('MoodPatterns_ThreeTenseTuesdays_FlagsTuesdayAtTheMedianBoundary', () => {
    // Median mood score 2 sits exactly on the low-mood line (≤2) — the boundary flags.
    const result = moodPatterns([entry(2, 'tense'), entry(2, 'tense'), entry(2, 'tense')])
    expect(result).toEqual({ lowWeekdays: [{ weekday: 2, medianMood: 2 }], enoughData: true })
  })

  it('MoodPatterns_MedianJustAboveTheBoundary_DoesNotFlag', () => {
    // Scores [2, 2, 4, 4] → even-count median (2+4)/2 = 3 > 2 — no flag.
    const result = moodPatterns([
      entry(2, 'tense'),
      entry(2, 'tense'),
      entry(2, 'good'),
      entry(2, 'good'),
    ])
    expect(result).toEqual({ lowWeekdays: [], enoughData: true })
  })

  it('MoodPatterns_EvenCountMedianAtTheBoundary_Flags', () => {
    // Scores [1, 2, 2, 4] → median (2+2)/2 = 2 ≤ 2 — the even-count boundary also flags.
    const result = moodPatterns([
      entry(4, 'stressed'),
      entry(4, 'tense'),
      entry(4, 'tense'),
      entry(4, 'good'),
    ])
    expect(result.lowWeekdays).toEqual([{ weekday: 4, medianMood: 2 }])
  })

  it('MoodPatterns_GoodWeekdayWithEnoughSamples_IsNotFlagged', () => {
    const result = moodPatterns([entry(1, 'good'), entry(1, 'good'), entry(1, 'tense')])
    // Median of [2, 4, 4] is 4 — a mostly-good weekday never reads as a pattern.
    expect(result).toEqual({ lowWeekdays: [], enoughData: true })
  })

  it('MoodPatterns_MultipleLowWeekdays_ComeBackInAscendingWeekdayOrder', () => {
    // Friday's entries arrive before Monday's — the result order must not depend on input order.
    const result = moodPatterns([
      entry(5, 'stressed'),
      entry(5, 'stressed'),
      entry(5, 'stressed'),
      entry(1, 'tense'),
      entry(1, 'tense'),
      entry(1, 'tense'),
    ])
    expect(result.lowWeekdays).toEqual([
      { weekday: 1, medianMood: 2 },
      { weekday: 5, medianMood: 1 },
    ])
  })

  it('MoodPatterns_LoweredMinimum_IsRespected', () => {
    // An explicit minPerWeekday=1 flags a single stressed Wednesday — the default never would.
    expect(moodPatterns([entry(3, 'stressed')], 1)).toEqual({
      lowWeekdays: [{ weekday: 3, medianMood: 1 }],
      enoughData: true,
    })
    expect(MIN_WEEKDAY_MOOD_SAMPLES).toBe(3)
  })
})

describe('moodEntryOf', () => {
  it('MoodEntryOf_KnownDates_DerivesTheServersUtcSundayZeroWeekday', () => {
    // Same convention as the API's `weekdayOf`: UTC, 0 = Sunday … 6 = Saturday.
    expect(moodEntryOf('2026-07-19', 'good')).toEqual({
      day: '2026-07-19',
      weekday: 0,
      mood: 'good',
    })
    expect(moodEntryOf('2026-07-20', 'tense').weekday).toBe(1)
    expect(moodEntryOf('2026-07-21', 'stressed').weekday).toBe(2)
    expect(moodEntryOf('2026-07-25', 'good').weekday).toBe(6)
  })
})
