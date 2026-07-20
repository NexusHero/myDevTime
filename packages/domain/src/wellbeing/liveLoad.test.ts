import { describe, expect, it } from 'vitest'
import {
  evaluateLiveLoad,
  liveLoadScore,
  NO_BREAK_CAP_MS,
  LONG_DAY_CAP_MS,
  WATCH_FOCUS_MS,
  WATCH_WORKED_MS,
  WATCH_BACK_TO_BACK,
  type LiveLoadInput,
} from './liveLoad.js'
import { CONSECUTIVE_HEAVY_MINIMUM } from './baseline.js'

/**
 * Acceptance for the intraday live-load core (ADR-0071 P1, REQ-067). The universal hard caps
 * (ArbZG-grounded) must fire regardless of the person's baseline; the watch band must catch
 * "approaching a cap" and "clearly above your own normal"; a short history (`normalHigh = +∞`)
 * must never read as above-baseline; and an empty/zero day is calm. Each cap and watch boundary
 * is pinned just-below / at / above, and reasons accumulate across independent pressures.
 */

const HOUR = 3_600_000
const MINUTE = 60_000

/** A quiet day with a wide-open own band; overrides pick out the pressure under test. */
function input(overrides: Partial<LiveLoadInput> = {}): LiveLoadInput {
  return {
    now: 1_700_000_000_000,
    workedMsToday: 0,
    focusMsSinceBreak: 0,
    backToBackMeetings: 0,
    overtimeMsToday: 0,
    baselineNormalHigh: Number.POSITIVE_INFINITY,
    consecutiveHeavyDays: 0,
    ...overrides,
  }
}

describe('evaluateLiveLoad — hard caps (baseline-independent)', () => {
  it('NoBreakCap_JustBelowSixHours_DoesNotSpeakUp', () => {
    const load = evaluateLiveLoad(input({ focusMsSinceBreak: NO_BREAK_CAP_MS - MINUTE }))
    expect(load.hardCapHit).toBe(false)
    expect(load.level).not.toBe('speak-up')
  })

  it('NoBreakCap_AtExactlySixHours_SpeaksUpWithHardCap', () => {
    const load = evaluateLiveLoad(input({ focusMsSinceBreak: NO_BREAK_CAP_MS }))
    expect(load).toEqual({ level: 'speak-up', reasons: ['no-break'], hardCapHit: true })
  })

  it('NoBreakCap_AboveSixHours_SpeaksUpEvenWithAnInfiniteBaseline', () => {
    // The cap is universal: a wide-open own band (short history) must not absorb it.
    const load = evaluateLiveLoad(input({ focusMsSinceBreak: 7 * HOUR }))
    expect(load.level).toBe('speak-up')
    expect(load.hardCapHit).toBe(true)
    expect(load.reasons).toContain('no-break')
  })

  it('LongDayCap_JustBelowNineAndAHalfHours_DoesNotHitTheCap', () => {
    const load = evaluateLiveLoad(input({ workedMsToday: LONG_DAY_CAP_MS - MINUTE }))
    expect(load.hardCapHit).toBe(false)
  })

  it('LongDayCap_AtNineAndAHalfHours_SpeaksUpWithHardCap', () => {
    const load = evaluateLiveLoad(input({ workedMsToday: LONG_DAY_CAP_MS }))
    expect(load).toEqual({ level: 'speak-up', reasons: ['long-day'], hardCapHit: true })
  })

  it('ConsecutiveHeavyCap_JustBelowTheRun_DoesNotHitTheCap', () => {
    const load = evaluateLiveLoad(input({ consecutiveHeavyDays: CONSECUTIVE_HEAVY_MINIMUM - 1 }))
    expect(load.hardCapHit).toBe(false)
    expect(load.reasons).not.toContain('consecutive-heavy')
  })

  it('ConsecutiveHeavyCap_AtTheRunMinimum_SpeaksUpWithHardCap', () => {
    const load = evaluateLiveLoad(input({ consecutiveHeavyDays: CONSECUTIVE_HEAVY_MINIMUM }))
    expect(load).toEqual({ level: 'speak-up', reasons: ['consecutive-heavy'], hardCapHit: true })
  })
})

describe('evaluateLiveLoad — watch band (approaching a cap)', () => {
  it('Focus_JustBelowFiveHours_StaysCalm', () => {
    const load = evaluateLiveLoad(input({ focusMsSinceBreak: WATCH_FOCUS_MS - MINUTE }))
    expect(load).toEqual({ level: 'calm', reasons: [], hardCapHit: false })
  })

  it('Focus_AtFiveHours_IsWatchWithNoBreakReason', () => {
    const load = evaluateLiveLoad(input({ focusMsSinceBreak: WATCH_FOCUS_MS }))
    expect(load).toEqual({ level: 'watch', reasons: ['no-break'], hardCapHit: false })
  })

  it('Worked_JustBelowEightAndAHalfHours_StaysCalm', () => {
    const load = evaluateLiveLoad(input({ workedMsToday: WATCH_WORKED_MS - MINUTE }))
    expect(load).toEqual({ level: 'calm', reasons: [], hardCapHit: false })
  })

  it('Worked_AtEightAndAHalfHours_IsWatchWithLongDayReason', () => {
    const load = evaluateLiveLoad(input({ workedMsToday: WATCH_WORKED_MS }))
    expect(load).toEqual({ level: 'watch', reasons: ['long-day'], hardCapHit: false })
  })

  it('BackToBackMeetings_JustBelowThree_StaysCalm', () => {
    // Two b2b meetings score 2.0, still inside an infinite own band → nothing to say.
    const load = evaluateLiveLoad(input({ backToBackMeetings: WATCH_BACK_TO_BACK - 1 }))
    expect(load).toEqual({ level: 'calm', reasons: [], hardCapHit: false })
  })

  it('BackToBackMeetings_AtThree_IsWatchWithMeetingMarathonReason', () => {
    const load = evaluateLiveLoad(input({ backToBackMeetings: WATCH_BACK_TO_BACK }))
    expect(load).toEqual({ level: 'watch', reasons: ['meeting-marathon'], hardCapHit: false })
  })
})

describe('evaluateLiveLoad — the own-baseline band (ADR-0066 H3)', () => {
  it('LiveScore_AboveAFiniteNormalHigh_IsWatchWithAboveBaselineReason', () => {
    // 2 b2b meetings → live score 2.0 > normalHigh 1.5, but below every watch cap.
    const load = evaluateLiveLoad(input({ backToBackMeetings: 2, baselineNormalHigh: 1.5 }))
    expect(load).toEqual({ level: 'watch', reasons: ['above-baseline'], hardCapHit: false })
  })

  it('LiveScore_ExactlyAtNormalHigh_IsNotAboveBaseline', () => {
    // "Above your usual", not "at your usual": the boundary itself stays calm.
    const load = evaluateLiveLoad(input({ backToBackMeetings: 2, baselineNormalHigh: 2 }))
    expect(load).toEqual({ level: 'calm', reasons: [], hardCapHit: false })
  })

  it('AboveBaseline_WithOvertimeContributing_AddsTheOvertimeTodayReason', () => {
    // Overtime pushes the score over the band → both reasons, in declaration order.
    const load = evaluateLiveLoad(input({ overtimeMsToday: 90 * MINUTE, baselineNormalHigh: 2.5 }))
    expect(load).toEqual({
      level: 'watch',
      reasons: ['overtime-today', 'above-baseline'],
      hardCapHit: false,
    })
  })

  it('OvertimeAlone_WithoutCrossingTheBand_DoesNotSpeak', () => {
    // Overtime is a *contribution*, not its own trigger: below the band it stays calm.
    const load = evaluateLiveLoad(input({ overtimeMsToday: 30 * MINUTE, baselineNormalHigh: 5 }))
    expect(load).toEqual({ level: 'calm', reasons: [], hardCapHit: false })
  })

  it('ShortHistory_InfiniteNormalHigh_NeverReadsAboveBaseline', () => {
    // A huge overtime score with no own band yet: honest silence, never a verdict from thin data.
    const load = evaluateLiveLoad(input({ overtimeMsToday: 5 * HOUR }))
    expect(load).toEqual({ level: 'calm', reasons: [], hardCapHit: false })
  })
})

describe('evaluateLiveLoad — calm base case and reason accumulation', () => {
  it('AllZeroInputs_IsCalmWithNoReasons', () => {
    expect(evaluateLiveLoad(input())).toEqual({ level: 'calm', reasons: [], hardCapHit: false })
  })

  it('MultiplePressures_AccumulateReasonsInDeclarationOrder', () => {
    // Focus over the 6 h cap + worked in the watch band + a meeting marathon + a burst
    // baseline: one speak-up carrying every firing reason, hard cap flagged.
    const load = evaluateLiveLoad(
      input({
        workedMsToday: WATCH_WORKED_MS,
        focusMsSinceBreak: NO_BREAK_CAP_MS,
        backToBackMeetings: WATCH_BACK_TO_BACK,
        overtimeMsToday: 60 * MINUTE,
        baselineNormalHigh: 1,
      }),
    )
    expect(load.level).toBe('speak-up')
    expect(load.hardCapHit).toBe(true)
    expect(load.reasons).toEqual([
      'long-day',
      'no-break',
      'meeting-marathon',
      'overtime-today',
      'above-baseline',
    ])
  })
})

describe('liveLoadScore — the composite on the dayReview scale', () => {
  it('MirrorsTheDayReviewWeights_PerTerm', () => {
    // 9 h worked → 1.0; 60 min overtime → 2.0; 2 b2b → 2.0; 3 h focus → 2 owed breaks → 2.0.
    expect(liveLoadScore(input({ workedMsToday: 9 * HOUR }))).toBe(1)
    expect(liveLoadScore(input({ overtimeMsToday: 60 * MINUTE }))).toBe(2)
    expect(liveLoadScore(input({ backToBackMeetings: 2 }))).toBe(2)
    expect(liveLoadScore(input({ focusMsSinceBreak: 3 * HOUR }))).toBe(2)
  })

  it('NegativeOrZeroInputs_ScoreZero', () => {
    expect(liveLoadScore(input({ overtimeMsToday: -HOUR, workedMsToday: 0 }))).toBe(0)
  })
})
