import { describe, expect, it } from 'vitest'
import { focusStreak, workloadLoad, type DayFocus } from './balance.js'

function day(date: string, focusMin: number, absence = false): DayFocus {
  return { date, focusMin, absence }
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
