import { describe, expect, it } from 'vitest'
import {
  reviewDay,
  LONG_DAY_MINUTES,
  type DayReviewInput,
  type WellbeingSignal,
  type WellbeingSignalKind,
} from './dayReview.js'

/**
 * Acceptance for the Evening Companion day-review core (design v14 §H, ADR-0005). Pure and
 * deterministic: already-computed signals → a four-valued load band + structured facts, never
 * prose, never a fabricated number, never a diagnosis. Covers every band boundary, every signal
 * kind (firing and NOT firing), each severity step, and the empty/absence/degenerate inputs.
 */

/** A quiet baseline day — no pressures at all; individual tests raise one dimension at a time. */
const QUIET: DayReviewInput = {
  plannedMinutes: 480,
  actualMinutes: 480,
  overtimeMinutes: 0,
  breakShortfallMinutes: 0,
  meetingCount: 0,
  backToBackMeetingCount: 0,
  planDriftMinutes: 0,
  isAbsenceDay: false,
}

function signalOf(review: { signals: readonly WellbeingSignal[] }, kind: WellbeingSignalKind) {
  return review.signals.find(s => s.kind === kind)
}

describe('reviewDay — load banding', () => {
  it('EmptyOrdinaryDay_IsLightWithNoSignals', () => {
    const review = reviewDay(QUIET)
    expect(review.loadLevel).toBe('light')
    expect(review.loadScore).toBe(0)
    expect(review.signals).toEqual([])
  })

  it('ZeroEverythingDay_IsLightNeverCrashes', () => {
    const review = reviewDay({ ...QUIET, plannedMinutes: 0, actualMinutes: 0 })
    expect(review.loadLevel).toBe('light')
    expect(review.loadScore).toBe(0)
  })

  it('JustBelowNormalEdge_StaysLight', () => {
    // overtime 30 → 1.0 point; below the 2.0 normal edge.
    const review = reviewDay({ ...QUIET, overtimeMinutes: 30 })
    expect(review.loadScore).toBe(1)
    expect(review.loadLevel).toBe('light')
  })

  it('AtNormalEdge_IsNormal', () => {
    // overtime 60 → 2.0 points == LOAD_BAND_NORMAL.
    const review = reviewDay({ ...QUIET, overtimeMinutes: 60 })
    expect(review.loadScore).toBe(2)
    expect(review.loadLevel).toBe('normal')
  })

  it('AtHeavyEdge_IsHeavy', () => {
    // overtime 150 → 5.0 points == LOAD_BAND_HEAVY.
    const review = reviewDay({ ...QUIET, overtimeMinutes: 150 })
    expect(review.loadScore).toBe(5)
    expect(review.loadLevel).toBe('heavy')
  })

  it('AtOverloadEdge_IsOverload', () => {
    // overtime 240 → 8.0 points == LOAD_BAND_OVERLOAD.
    const review = reviewDay({ ...QUIET, overtimeMinutes: 240 })
    expect(review.loadScore).toBe(8)
    expect(review.loadLevel).toBe('overload')
  })

  it('CombinesEveryPressureIntoTheScore_Overload', () => {
    const review = reviewDay({
      plannedMinutes: 480,
      actualMinutes: 600, // long day → (600−480)/60 = 2.0
      overtimeMinutes: 120, // → 4.0
      breakShortfallMinutes: 30, // → 2.0
      meetingCount: 6, // (6−4)*0.5 = 1.0
      backToBackMeetingCount: 3, // → 3.0
      moodScore: 2, // → 1.0
      planDriftMinutes: 90, // → 3.0
      isAbsenceDay: false,
    })
    expect(review.loadScore).toBe(16)
    expect(review.loadLevel).toBe('overload')
  })

  it('RoundsTheScoreToOneDecimal', () => {
    // meetings 5 → (5−4)*0.5 = 0.5 exactly; keep the decimal.
    const review = reviewDay({ ...QUIET, meetingCount: 5 })
    expect(review.loadScore).toBe(0.5)
  })
})

describe('reviewDay — absence day', () => {
  it('AbsenceDay_IsLightWithNoSignals_EvenWithLoggedMoodOrHours', () => {
    const review = reviewDay({
      ...QUIET,
      isAbsenceDay: true,
      actualMinutes: 900,
      overtimeMinutes: 300,
      moodScore: 1,
      meetingCount: 9,
    })
    expect(review.loadLevel).toBe('light')
    expect(review.loadScore).toBe(0)
    expect(review.signals).toEqual([])
  })
})

describe('reviewDay — long-day signal', () => {
  it('DoesNotFireAtOrBelowTheThreshold', () => {
    expect(
      signalOf(reviewDay({ ...QUIET, actualMinutes: LONG_DAY_MINUTES }), 'long-day'),
    ).toBeUndefined()
  })

  it('FiresLowJustOverTheThreshold', () => {
    const s = signalOf(reviewDay({ ...QUIET, actualMinutes: LONG_DAY_MINUTES + 30 }), 'long-day')
    expect(s).toEqual({ kind: 'long-day', severity: 'low', detail: { minutesOver: 30 } })
  })

  it('FiresMediumThenHighAsItRuns', () => {
    expect(
      signalOf(reviewDay({ ...QUIET, actualMinutes: LONG_DAY_MINUTES + 60 }), 'long-day')?.severity,
    ).toBe('medium')
    expect(
      signalOf(reviewDay({ ...QUIET, actualMinutes: LONG_DAY_MINUTES + 180 }), 'long-day')
        ?.severity,
    ).toBe('high')
  })
})

describe('reviewDay — overtime signal', () => {
  it('DoesNotFireAtZero', () => {
    expect(signalOf(reviewDay(QUIET), 'overtime')).toBeUndefined()
  })

  it('FiresAcrossAllThreeSeverities', () => {
    expect(signalOf(reviewDay({ ...QUIET, overtimeMinutes: 30 }), 'overtime')?.severity).toBe('low')
    expect(signalOf(reviewDay({ ...QUIET, overtimeMinutes: 60 }), 'overtime')?.severity).toBe(
      'medium',
    )
    expect(signalOf(reviewDay({ ...QUIET, overtimeMinutes: 120 }), 'overtime')?.severity).toBe(
      'high',
    )
  })

  it('CarriesTheRawOvertimeMinutes', () => {
    expect(signalOf(reviewDay({ ...QUIET, overtimeMinutes: 45 }), 'overtime')?.detail).toEqual({
      overtimeMinutes: 45,
    })
  })
})

describe('reviewDay — break-shortfall signal', () => {
  it('DoesNotFireAtZero', () => {
    expect(signalOf(reviewDay(QUIET), 'break-shortfall')).toBeUndefined()
  })

  it('FiresAcrossAllThreeSeverities', () => {
    expect(
      signalOf(reviewDay({ ...QUIET, breakShortfallMinutes: 10 }), 'break-shortfall')?.severity,
    ).toBe('low')
    expect(
      signalOf(reviewDay({ ...QUIET, breakShortfallMinutes: 15 }), 'break-shortfall')?.severity,
    ).toBe('medium')
    expect(
      signalOf(reviewDay({ ...QUIET, breakShortfallMinutes: 30 }), 'break-shortfall')?.severity,
    ).toBe('high')
  })

  it('CarriesTheShortfallMinutes', () => {
    expect(
      signalOf(reviewDay({ ...QUIET, breakShortfallMinutes: 12 }), 'break-shortfall')?.detail,
    ).toEqual({
      shortfallMinutes: 12,
    })
  })
})

describe('reviewDay — back-to-back-meetings signal', () => {
  it('DoesNotFireBelowTheMinimum', () => {
    expect(
      signalOf(reviewDay({ ...QUIET, backToBackMeetingCount: 1 }), 'back-to-back-meetings'),
    ).toBeUndefined()
  })

  it('FiresMediumAtTheMinimumAndHighWhenPronounced', () => {
    expect(
      signalOf(reviewDay({ ...QUIET, backToBackMeetingCount: 2 }), 'back-to-back-meetings')
        ?.severity,
    ).toBe('medium')
    expect(
      signalOf(reviewDay({ ...QUIET, backToBackMeetingCount: 4 }), 'back-to-back-meetings')
        ?.severity,
    ).toBe('high')
  })

  it('CarriesTheCount', () => {
    expect(
      signalOf(reviewDay({ ...QUIET, backToBackMeetingCount: 3 }), 'back-to-back-meetings')?.detail,
    ).toEqual({
      count: 3,
    })
  })
})

describe('reviewDay — meeting-heavy signal', () => {
  it('DoesNotFireBelowTheMinimum', () => {
    expect(signalOf(reviewDay({ ...QUIET, meetingCount: 4 }), 'meeting-heavy')).toBeUndefined()
  })

  it('FiresMediumAtTheMinimumAndHighWhenPronounced', () => {
    expect(signalOf(reviewDay({ ...QUIET, meetingCount: 5 }), 'meeting-heavy')?.severity).toBe(
      'medium',
    )
    expect(signalOf(reviewDay({ ...QUIET, meetingCount: 8 }), 'meeting-heavy')?.severity).toBe(
      'high',
    )
  })

  it('CarriesTheCount', () => {
    expect(signalOf(reviewDay({ ...QUIET, meetingCount: 6 }), 'meeting-heavy')?.detail).toEqual({
      count: 6,
    })
  })
})

describe('reviewDay — plan-overrun signal', () => {
  it('DoesNotFireAtOrBelowTheOverrunThreshold', () => {
    expect(signalOf(reviewDay({ ...QUIET, planDriftMinutes: 60 }), 'plan-overrun')).toBeUndefined()
  })

  it('DoesNotFireOnNegativeDrift_UnderThePlanIsNotAnOverrun', () => {
    expect(
      signalOf(reviewDay({ ...QUIET, planDriftMinutes: -120 }), 'plan-overrun'),
    ).toBeUndefined()
  })

  it('FiresLowThenMediumThenHigh', () => {
    expect(signalOf(reviewDay({ ...QUIET, planDriftMinutes: 90 }), 'plan-overrun')?.severity).toBe(
      'low',
    )
    expect(signalOf(reviewDay({ ...QUIET, planDriftMinutes: 120 }), 'plan-overrun')?.severity).toBe(
      'medium',
    )
    expect(signalOf(reviewDay({ ...QUIET, planDriftMinutes: 180 }), 'plan-overrun')?.severity).toBe(
      'high',
    )
  })

  it('CarriesTheMinutesOver', () => {
    expect(signalOf(reviewDay({ ...QUIET, planDriftMinutes: 95 }), 'plan-overrun')?.detail).toEqual(
      { minutesOver: 95 },
    )
  })
})

describe('reviewDay — low-mood signal', () => {
  it('IsAbsentWhenMoodWasNotLogged_NeverGuessed', () => {
    expect(signalOf(reviewDay(QUIET), 'low-mood')).toBeUndefined()
  })

  it('DoesNotFireForNeutralOrGoodMood', () => {
    expect(signalOf(reviewDay({ ...QUIET, moodScore: 3 }), 'low-mood')).toBeUndefined()
    expect(signalOf(reviewDay({ ...QUIET, moodScore: 5 }), 'low-mood')).toBeUndefined()
  })

  it('FiresMediumAtMoodTwoAndHighAtMoodOne', () => {
    expect(signalOf(reviewDay({ ...QUIET, moodScore: 2 }), 'low-mood')).toEqual({
      kind: 'low-mood',
      severity: 'medium',
      detail: { moodScore: 2 },
    })
    expect(signalOf(reviewDay({ ...QUIET, moodScore: 1 }), 'low-mood')).toEqual({
      kind: 'low-mood',
      severity: 'high',
      detail: { moodScore: 1 },
    })
  })
})

describe('reviewDay — signal ordering', () => {
  it('EmitsSignalsInAStableKindOrder', () => {
    const review = reviewDay({
      plannedMinutes: 480,
      actualMinutes: 700, // long-day
      overtimeMinutes: 90, // overtime
      breakShortfallMinutes: 20, // break-shortfall
      meetingCount: 6, // meeting-heavy
      backToBackMeetingCount: 2, // back-to-back-meetings
      moodScore: 1, // low-mood
      planDriftMinutes: 120, // plan-overrun
      isAbsenceDay: false,
    })
    expect(review.signals.map(s => s.kind)).toEqual([
      'long-day',
      'overtime',
      'break-shortfall',
      'back-to-back-meetings',
      'meeting-heavy',
      'plan-overrun',
      'low-mood',
    ])
  })
})
