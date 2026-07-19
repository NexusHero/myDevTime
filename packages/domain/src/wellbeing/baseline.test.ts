import { describe, expect, it } from 'vitest'
import { computeBaseline, type BaselineDay, type PatternFlag } from './baseline.js'

/**
 * Acceptance for the Evening Companion baseline core (design v14 §H3, ADR-0005). The band is the
 * person's *own* norm (mean ± own spread), never a fixed threshold; short histories are handled
 * honestly (wide band, no flags); trend and pattern flags are deterministic. Covers the band math,
 * the short-history guard, each trend direction (incl. boundary), and each pattern flag firing and
 * NOT firing.
 */

/** Build a day series from `[weekday, loadScore]` pairs, oldest→newest. */
function days(pairs: readonly (readonly [number, number])[]): BaselineDay[] {
  return pairs.map(([weekday, loadScore]) => ({ weekday, loadScore }))
}

/** Same load score on distinct weekdays (0,1,2,…) so no weekday can be flagged. */
function distinctWeekdays(scores: readonly number[]): BaselineDay[] {
  return scores.map((loadScore, i) => ({ weekday: i % 7, loadScore }))
}

function flagsOf(flags: readonly PatternFlag[], kind: PatternFlag['kind']): readonly PatternFlag[] {
  return flags.filter(f => f.kind === kind)
}

describe('computeBaseline — the own-norm band', () => {
  it('IsMeanPlusMinusOwnSpread', () => {
    // scores mean 5, population spread 2 → band [3, 7]. Order avoids a heavy run.
    const b = computeBaseline(distinctWeekdays([9, 4, 5, 4, 7, 4, 5, 2]))
    expect(b.normalLow).toBeCloseTo(3, 5)
    expect(b.normalHigh).toBeCloseTo(7, 5)
  })

  it('ClampsTheLowerEdgeAtZero_NeverNegative', () => {
    // mean 1, spread 2 → mean − spread = −1, clamped to 0.
    const b = computeBaseline(distinctWeekdays([0, 0, 0, 0, 5]))
    expect(b.normalLow).toBe(0)
    expect(b.normalHigh).toBeCloseTo(3, 5)
  })

  it('CollapsesToASinglePointForAPerfectlySteadyHistory', () => {
    const b = computeBaseline(distinctWeekdays([4, 4, 4, 4, 4]))
    expect(b.normalLow).toBe(4)
    expect(b.normalHigh).toBe(4)
  })
})

describe('computeBaseline — short history is not judged', () => {
  it('EmptySeries_IsAWideBandSteadyNoFlags_NeverCrashes', () => {
    const b = computeBaseline([])
    expect(b.normalLow).toBe(0)
    expect(b.normalHigh).toBe(Number.POSITIVE_INFINITY)
    expect(b.trend).toBe('steady')
    expect(b.patternFlags).toEqual([])
  })

  it('BelowMinimumDays_IsAWideBandWithNoFlags_EvenWhenAllHeavy', () => {
    const b = computeBaseline(distinctWeekdays([9, 9, 9, 9])) // 4 days < MIN_BASELINE_DAYS
    expect(b.normalHigh).toBe(Number.POSITIVE_INFINITY)
    expect(b.trend).toBe('steady')
    expect(b.patternFlags).toEqual([])
  })

  it('AtExactlyTheMinimumDays_ComputesARealBand', () => {
    const b = computeBaseline(distinctWeekdays([4, 4, 4, 4, 4])) // 5 days == MIN_BASELINE_DAYS
    expect(b.normalHigh).toBe(4)
  })
})

describe('computeBaseline — trend', () => {
  it('RisingWhenTheLaterHalfClearlyExceedsTheEarlier', () => {
    expect(computeBaseline(distinctWeekdays([1, 1, 2, 6, 7])).trend).toBe('rising')
  })

  it('FallingWhenTheLaterHalfClearlyTrailsTheEarlier', () => {
    expect(computeBaseline(distinctWeekdays([7, 6, 2, 1, 1])).trend).toBe('falling')
  })

  it('SteadyWhenTheHalvesAreLevel', () => {
    expect(computeBaseline(distinctWeekdays([3, 3, 3, 3, 3])).trend).toBe('steady')
  })

  it('SteadyJustBelowTheTrendDelta_RisingAtIt', () => {
    // 6 days, halves of 3 each. Later half mean 3.9 → delta 0.9 < 1 → steady.
    expect(computeBaseline(distinctWeekdays([3, 3, 3, 3.9, 3.9, 3.9])).trend).toBe('steady')
    // Later half mean 4.0 → delta 1.0 == TREND_DELTA → rising.
    expect(computeBaseline(distinctWeekdays([3, 3, 3, 4, 4, 4])).trend).toBe('rising')
  })
})

describe('computeBaseline — consecutive-heavy-days flag', () => {
  it('FiresWithTheRunLengthWhenEnoughHeavyDaysAreInARow', () => {
    const b = computeBaseline(distinctWeekdays([1, 5, 5, 5, 1]))
    expect(flagsOf(b.patternFlags, 'consecutive-heavy-days')).toEqual([
      { kind: 'consecutive-heavy-days', detail: { runLength: 3 } },
    ])
  })

  it('ReportsTheLongestRun', () => {
    const b = computeBaseline(distinctWeekdays([5, 5, 5, 5, 1]))
    expect(flagsOf(b.patternFlags, 'consecutive-heavy-days')).toEqual([
      { kind: 'consecutive-heavy-days', detail: { runLength: 4 } },
    ])
  })

  it('DoesNotFireWhenTheLongestRunIsTooShort', () => {
    const b = computeBaseline(distinctWeekdays([5, 5, 1, 5, 5])) // runs of 2 only
    expect(flagsOf(b.patternFlags, 'consecutive-heavy-days')).toEqual([])
  })

  it('DoesNotFireWhenDaysAreJustBelowHeavy', () => {
    const b = computeBaseline(distinctWeekdays([4.9, 4.9, 4.9, 4.9, 4.9]))
    expect(flagsOf(b.patternFlags, 'consecutive-heavy-days')).toEqual([])
  })
})

describe('computeBaseline — weekday-overbook flag', () => {
  it('FiresForAWeekdayWhoseOwnMeanRunsWellAboveTheOverallMean', () => {
    const b = computeBaseline(
      days([
        [0, 1],
        [1, 1],
        [2, 7],
        [3, 1],
        [4, 1],
        [2, 7],
        [0, 1],
      ]),
    )
    const overbook = flagsOf(b.patternFlags, 'weekday-overbook')
    expect(overbook).toHaveLength(1)
    const flag = overbook[0]
    expect(flag?.kind).toBe('weekday-overbook')
    if (flag?.kind === 'weekday-overbook') {
      expect(flag.detail.weekday).toBe(2)
      expect(flag.detail.weekdayMean).toBeCloseTo(7, 5)
      expect(flag.detail.overallMean).toBeCloseTo(19 / 7, 5)
    }
  })

  it('DoesNotFireWhenTheWeekdayIsOnlyMildlyAbove', () => {
    // weekday 2 mean 4, overall ≈ 2.57 → delta ≈ 1.43 < WEEKDAY_OVERBOOK_DELTA.
    const b = computeBaseline(
      days([
        [0, 2],
        [1, 2],
        [2, 4],
        [3, 2],
        [4, 2],
        [2, 4],
        [5, 2],
      ]),
    )
    expect(flagsOf(b.patternFlags, 'weekday-overbook')).toEqual([])
  })

  it('DoesNotFireOnASingleSample_TooLittleToJudge', () => {
    // weekday 4 has one very high day; one sample is not enough.
    const b = computeBaseline(
      days([
        [0, 1],
        [1, 1],
        [2, 1],
        [3, 1],
        [4, 9],
      ]),
    )
    expect(flagsOf(b.patternFlags, 'weekday-overbook')).toEqual([])
  })

  it('ListsMultipleOverbookedWeekdaysAscending', () => {
    const b = computeBaseline(
      days([
        [1, 8],
        [0, 1],
        [1, 8],
        [2, 1],
        [3, 8],
        [4, 1],
        [3, 8],
      ]),
    )
    const overbook = flagsOf(b.patternFlags, 'weekday-overbook')
    expect(overbook.map(f => (f.kind === 'weekday-overbook' ? f.detail.weekday : -1))).toEqual([
      1, 3,
    ])
  })
})

describe('computeBaseline — pattern-flag ordering', () => {
  it('PutsConsecutiveHeavyBeforeWeekdayOverbook', () => {
    const b = computeBaseline(
      days([
        [2, 8],
        [2, 8],
        [2, 8],
        [0, 1],
        [1, 1],
      ]),
    )
    expect(b.patternFlags.map(f => f.kind)).toEqual(['consecutive-heavy-days', 'weekday-overbook'])
  })
})
