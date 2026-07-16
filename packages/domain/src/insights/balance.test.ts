import { describe, expect, it } from 'vitest'
import {
  dailyHoursDistribution,
  focusStreak,
  weeklyFocusTrend,
  workloadLoad,
  type DayFocus,
} from './balance.js'

function day(date: string, focusMin: number, absence = false): DayFocus {
  return { date, focusMin, absence }
}

/** A run of `n` days (dates irrelevant to the trend/distribution math) with given minutes. */
function days(minutes: readonly number[]): DayFocus[] {
  return minutes.map((m, i) => day(`2026-01-${String(i + 1).padStart(2, '0')}`, m))
}

describe('focusStreak', () => {
  it('CountsConsecutiveQualifyingDays_UpToToday', () => {
    const days = [day('2026-07-13', 180), day('2026-07-14', 130), day('2026-07-15', 240)]
    expect(focusStreak(days)).toBe(3)
  })

  it('BreaksAtTheFirstNonQualifyingDay', () => {
    const days = [day('2026-07-12', 200), day('2026-07-13', 30), day('2026-07-14', 200)]
    expect(focusStreak(days)).toBe(1) // only the last day; the 30-min day breaks it
  })

  it('AbsenceDays_BridgeTheStreakWithoutBreakingOrAdding', () => {
    const days = [
      day('2026-07-13', 200),
      day('2026-07-14', 0, true), // vacation — bridges
      day('2026-07-15', 200),
    ]
    expect(focusStreak(days)).toBe(2) // two worked days, absence bridged (not +3)
  })

  it('UnfinishedToday_DoesNotResetYesterdaysStreak', () => {
    const days = [day('2026-07-13', 200), day('2026-07-14', 200), day('2026-07-15', 20)]
    expect(focusStreak(days)).toBe(2) // today (20 min) is in progress → ignored
  })

  it('QualifyingToday_CountsWithoutGrace', () => {
    const days = [day('2026-07-14', 200), day('2026-07-15', 200)]
    expect(focusStreak(days)).toBe(2)
  })

  it('RespectsACustomThreshold', () => {
    const days = [day('2026-07-14', 90), day('2026-07-15', 90)]
    expect(focusStreak(days, { thresholdMin: 60 })).toBe(2)
    expect(focusStreak(days, { thresholdMin: 120 })).toBe(0)
  })

  it('EmptyOrAllAbsence_IsZero', () => {
    expect(focusStreak([])).toBe(0)
    expect(focusStreak([day('2026-07-14', 0, true), day('2026-07-15', 0, true)])).toBe(0)
  })
})

describe('workloadLoad', () => {
  it('BelowThreeQuarterTarget_IsCalm', () => {
    expect(workloadLoad({ actualMin: 1400, targetMin: 2400 }).level).toBe('calm')
  })

  it('AroundTarget_IsSteady', () => {
    expect(workloadLoad({ actualMin: 2400, targetMin: 2400 }).level).toBe('steady')
    expect(workloadLoad({ actualMin: 2600, targetMin: 2400 }).level).toBe('steady')
  })

  it('WellOverTarget_IsElevated', () => {
    const load = workloadLoad({ actualMin: 3000, targetMin: 2400 })
    expect(load.level).toBe('elevated')
    expect(load.ratio).toBeCloseTo(1.25)
  })

  it('UnknownTarget_IsSteadyWithNullRatio', () => {
    expect(workloadLoad({ actualMin: 500, targetMin: 0 })).toEqual({
      level: 'steady',
      ratio: null,
      actualMin: 500,
      targetMin: 0,
    })
  })
})

describe('weeklyFocusTrend', () => {
  it('BucketsSevenDaysPerWeekNewestOnTheRight', () => {
    // 14 days of 60 min each → two full weeks of 420 min, right-aligned in 3 buckets.
    expect(weeklyFocusTrend(days(new Array<number>(14).fill(60)), 3)).toEqual([0, 420, 420])
  })

  it('SumsFocusMinutesWithinEachWeek', () => {
    // 7 days: 10,20,30,40,50,60,70 → one week = 280, in the last of two buckets.
    expect(weeklyFocusTrend(days([10, 20, 30, 40, 50, 60, 70]), 2)).toEqual([0, 280])
  })

  it('KeepsOnlyTheMostRecentWeeksWhenDataExceedsTheWindow', () => {
    // 21 days of 10 min: 3 weeks of 70, but only the last 2 buckets are asked for.
    expect(weeklyFocusTrend(days(new Array<number>(21).fill(10)), 2)).toEqual([70, 70])
  })

  it('NewestFullWeekIsRightmost_OlderPartialWeekSitsLeftOfIt', () => {
    // 10 days of 10 min: newest 7 → full week (70) rightmost; oldest 3 → partial (30)
    // one bucket left; the remaining bucket zero-pads. Newest is always on the right.
    expect(weeklyFocusTrend(days(new Array<number>(10).fill(10)), 3)).toEqual([0, 30, 70])
  })

  it('EmptyOrNonPositiveWeeks_ReturnsZeroFilledOrEmpty', () => {
    expect(weeklyFocusTrend([], 3)).toEqual([0, 0, 0])
    expect(weeklyFocusTrend(days([60, 60]), 0)).toEqual([])
  })
})

describe('dailyHoursDistribution', () => {
  it('FiveNumberSummaryOfActiveDays', () => {
    // 5 active days: 60,120,180,240,300 → min60 q1120 median180 q3240 max300.
    expect(dailyHoursDistribution(days([60, 120, 180, 240, 300]))).toEqual({
      min: 60,
      q1: 120,
      median: 180,
      q3: 240,
      max: 300,
    })
  })

  it('ExcludesAbsenceAndZeroDays', () => {
    const input: DayFocus[] = [
      day('2026-01-01', 100),
      day('2026-01-02', 0), // untracked day — not a short work day
      day('2026-01-03', 200, true), // absence — excluded
      day('2026-01-04', 200),
      day('2026-01-05', 300),
      day('2026-01-06', 400),
    ]
    const q = dailyHoursDistribution(input)
    expect(q?.min).toBe(100)
    expect(q?.max).toBe(400)
    expect(q?.median).toBe(250) // median of 100,200,300,400
  })

  it('InterpolatesQuartilesBetweenSamples', () => {
    // 4 active days 100,200,300,400 → q1 = 175, q3 = 325 (linear interpolation).
    const q = dailyHoursDistribution(days([400, 100, 300, 200]))
    expect(q?.q1).toBe(175)
    expect(q?.median).toBe(250)
    expect(q?.q3).toBe(325)
  })

  it('TooFewActiveDays_IsNull', () => {
    expect(dailyHoursDistribution(days([60, 120, 180]))).toBeNull()
    expect(dailyHoursDistribution(days([60, 120, 180]), 3)).not.toBeNull()
  })
})
