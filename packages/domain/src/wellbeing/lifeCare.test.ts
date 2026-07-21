import { describe, expect, it } from 'vitest'
import {
  EVENING_END_MIN,
  EVENING_START_MIN,
  MIN_EVENING_WINDOW_DAYS,
  REST_DAY_THRESHOLD_DEFAULT,
  freeEveningsIn,
  lifeCareSuggestions,
  type EveningBlock,
  type LifeCareInput,
} from './lifeCare.js'

/**
 * Sevi life care (ADR-0071 P5, REQ-071): the deterministic suggestion core behind the calm
 * life-care voices — no-free-evening, life-encroachment, rest-day — plus the pure evening
 * counter `freeEveningsIn`. Table tests over boundaries, ordering, insufficient windows,
 * and the honest empty case.
 */

const NO_INPUT: LifeCareInput = {
  eveningsFreeInWindow: 3,
  windowDays: 7,
  encroachingBlockId: null,
  consecutiveHeavyDays: 0,
}

describe('lifeCareSuggestions', () => {
  it('Suggestions_QuietWeek_ReturnsEmpty', () => {
    expect(lifeCareSuggestions(NO_INPUT)).toEqual([])
  })

  it('Suggestions_NoFreeEveningInFullWindow_FiresNoFreeEvening', () => {
    const out = lifeCareSuggestions({ ...NO_INPUT, eveningsFreeInWindow: 0, windowDays: 7 })
    expect(out).toEqual([{ kind: 'no-free-evening' }])
  })

  it('Suggestions_NoFreeEveningAtMinimumWindow_StillFires', () => {
    const out = lifeCareSuggestions({
      ...NO_INPUT,
      eveningsFreeInWindow: 0,
      windowDays: MIN_EVENING_WINDOW_DAYS,
    })
    expect(out).toEqual([{ kind: 'no-free-evening' }])
  })

  it('Suggestions_WindowTooShortToJudge_StaysSilent', () => {
    // 0 free evenings over 2 days is a weekend, not a pattern — below the minimum
    // window the core refuses to judge (honest silence from thin data).
    const out = lifeCareSuggestions({
      ...NO_INPUT,
      eveningsFreeInWindow: 0,
      windowDays: MIN_EVENING_WINDOW_DAYS - 1,
    })
    expect(out).toEqual([])
  })

  it('Suggestions_OneEveningStillFree_StaysSilent', () => {
    const out = lifeCareSuggestions({ ...NO_INPUT, eveningsFreeInWindow: 1, windowDays: 7 })
    expect(out).toEqual([])
  })

  it('Suggestions_EncroachedLifeBlock_FiresEncroachmentWithTheBlockId', () => {
    const out = lifeCareSuggestions({ ...NO_INPUT, encroachingBlockId: 'life-yoga' })
    expect(out).toEqual([{ kind: 'life-encroachment', blockId: 'life-yoga' }])
  })

  it('Suggestions_HeavyRunAtDefaultThreshold_FiresRestDay', () => {
    const out = lifeCareSuggestions({
      ...NO_INPUT,
      consecutiveHeavyDays: REST_DAY_THRESHOLD_DEFAULT,
    })
    expect(out).toEqual([{ kind: 'rest-day' }])
  })

  it('Suggestions_HeavyRunBelowDefaultThreshold_StaysSilent', () => {
    const out = lifeCareSuggestions({
      ...NO_INPUT,
      consecutiveHeavyDays: REST_DAY_THRESHOLD_DEFAULT - 1,
    })
    expect(out).toEqual([])
  })

  it('Suggestions_CustomRestThreshold_IsHonoured', () => {
    expect(lifeCareSuggestions({ ...NO_INPUT, consecutiveHeavyDays: 2 }, 2)).toEqual([
      { kind: 'rest-day' },
    ])
    expect(lifeCareSuggestions({ ...NO_INPUT, consecutiveHeavyDays: 4 }, 5)).toEqual([])
  })

  it('Suggestions_AllThreeFire_OrdersEncroachmentFirstThenEveningThenRest', () => {
    // The encroachment names a concrete, already-happening clash — most urgent, first.
    const out = lifeCareSuggestions({
      eveningsFreeInWindow: 0,
      windowDays: 7,
      encroachingBlockId: 'life-dinner',
      consecutiveHeavyDays: 4,
    })
    expect(out.map(s => s.kind)).toEqual(['life-encroachment', 'no-free-evening', 'rest-day'])
    expect(out[0]?.blockId).toBe('life-dinner')
  })
})

describe('freeEveningsIn', () => {
  const work = (dayIndex: number, startMin: number, endMin: number): EveningBlock => ({
    dayIndex,
    startMin,
    endMin,
    kind: 'actual',
  })

  it('FreeEvenings_NoBlocksAtAll_EveryEveningIsFree', () => {
    expect(freeEveningsIn([], 7)).toBe(7)
  })

  it('FreeEvenings_WorkOverlappingTheEveningWindow_ConsumesThatEvening', () => {
    // 17:00–19:00 dips into the 18–22 window → day 0 is gone; the other 6 stay free.
    expect(freeEveningsIn([work(0, 17 * 60, 19 * 60)], 7)).toBe(6)
  })

  it('FreeEvenings_WorkEndingExactlyAtEveningStart_DoesNotConsume', () => {
    // Half-open windows: an 09:00–18:00 day touches 18:00 but never enters the evening.
    expect(freeEveningsIn([work(0, 9 * 60, EVENING_START_MIN)], 7)).toBe(7)
  })

  it('FreeEvenings_WorkStartingExactlyAtEveningEnd_DoesNotConsume', () => {
    expect(freeEveningsIn([work(0, EVENING_END_MIN, 23 * 60)], 7)).toBe(7)
  })

  it('FreeEvenings_LifeAndBreakBlocksInTheEvening_KeepTheEveningFree', () => {
    // An evening spent on one's own life IS a kept evening — only work consumes it.
    const blocks: EveningBlock[] = [
      { dayIndex: 0, startMin: 18 * 60, endMin: 20 * 60, kind: 'life' },
      { dayIndex: 1, startMin: 19 * 60, endMin: 19 * 60 + 30, kind: 'break' },
    ]
    expect(freeEveningsIn(blocks, 7)).toBe(7)
  })

  it('FreeEvenings_EveryEveningBooked_ReturnsZero', () => {
    const blocks = Array.from({ length: 5 }, (_, day) => work(day, 18 * 60, 21 * 60))
    expect(freeEveningsIn(blocks, 5)).toBe(0)
  })

  it('FreeEvenings_BlockOutsideTheWindowDays_IsIgnored', () => {
    // Day 9 is outside a 7-day window; a negative day index is likewise off-window.
    expect(freeEveningsIn([work(9, 18 * 60, 21 * 60), work(-1, 18 * 60, 21 * 60)], 7)).toBe(7)
  })

  it('FreeEvenings_CustomEveningWindow_IsHonoured', () => {
    // With a 20–22 evening, a 18–19:30 meeting no longer touches it.
    expect(freeEveningsIn([work(0, 18 * 60, 19 * 60 + 30)], 7, 20 * 60, 22 * 60)).toBe(7)
    expect(freeEveningsIn([work(0, 21 * 60, 21 * 60 + 30)], 7, 20 * 60, 22 * 60)).toBe(6)
  })

  it('FreeEvenings_ZeroWindowDays_IsZero', () => {
    expect(freeEveningsIn([], 0)).toBe(0)
  })
})
