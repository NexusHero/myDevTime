import { describe, expect, it } from 'vitest'
import { HOUR_MS, MINUTE_MS } from '../tracking/time.js'
import { weekCapacity, type CapacityDay } from './plannable.js'
import {
  commitmentAdvisory,
  DEFAULT_OVERCOMMIT_TOLERANCE_MS,
  type AdvisoryBlock,
} from './overcommit.js'

/**
 * Table tests for the Scrum-Master advisory core (REQ-070, ADR-0071): the planned load of a
 * week measured against the *honest* plannable capacity (target minus life/protected — the
 * REQ-055 core, reused, never re-derived), with signed overages, day + week severity levels,
 * and the relief candidates a user could confirm. Meetings and protected blocks are never
 * offered as relief; breaks are rest, not load.
 */

/** A working week of `n` days at `hours` target each, with optional commitments per day. */
function week(
  n: number,
  hoursPerDay: number,
  commitmentsByDay: Record<number, CapacityDay['commitments']> = {},
) {
  return weekCapacity(
    Array.from({ length: n }, (_, d) => ({
      targetMs: hoursPerDay * HOUR_MS,
      commitments: commitmentsByDay[d] ?? [],
    })),
  )
}

function focus(lenMin: number, extra: Partial<AdvisoryBlock> = {}): AdvisoryBlock {
  return { kind: 'focus', startMin: 480, lenMin, ...extra }
}

describe('commitmentAdvisory', () => {
  it('commitmentAdvisory_EmptyWeekAndNoBlocks_WithinWithEmptyRelief', () => {
    const a = commitmentAdvisory(week(0, 0), [])
    expect(a.weekLevel).toBe('within')
    expect(a.dayLevel).toBe('within')
    expect(a.weekOverageMs).toBe(0)
    expect(a.dayOverageMs).toBe(0)
    expect(a.relief).toEqual([])
  })

  it('commitmentAdvisory_CapacityButNoBlocks_WithinAndNegativeSignedOverage', () => {
    const a = commitmentAdvisory(week(5, 8), [])
    expect(a.weekLevel).toBe('within')
    // Signed = planned − plannable: a fully free 40 h week reads −40 h, never a clamped 0.
    expect(a.weekOverageMs).toBe(-40 * HOUR_MS)
    expect(a.dayOverageMs).toBe(-8 * HOUR_MS)
    expect(a.relief).toEqual([])
  })

  it.each([
    // planned minutes over a 40 h plannable week → expected week level (default tolerance 30 min)
    { plannedMin: 40 * 60, level: 'within' as const },
    { plannedMin: 40 * 60 + 1, level: 'tight' as const },
    { plannedMin: 40 * 60 + 30, level: 'tight' as const },
    { plannedMin: 40 * 60 + 31, level: 'over' as const },
  ])('commitmentAdvisory_WeekPlanned$plannedMin' + 'Min_LevelIs$level', ({ plannedMin, level }) => {
    const a = commitmentAdvisory(week(5, 8), [focus(plannedMin)])
    expect(a.weekLevel).toBe(level)
    expect(a.weekOverageMs).toBe((plannedMin - 40 * 60) * MINUTE_MS)
  })

  it.each([
    { plannedMin: 8 * 60, level: 'within' as const },
    { plannedMin: 8 * 60 + 30, level: 'tight' as const },
    { plannedMin: 8 * 60 + 31, level: 'over' as const },
  ])(
    'commitmentAdvisory_DayPlanned$plannedMin' + 'Min_DayLevelIs$level',
    ({ plannedMin, level }) => {
      const a = commitmentAdvisory(week(5, 8), [focus(plannedMin, { day: 0 })])
      expect(a.dayLevel).toBe(level)
      expect(a.dayOverageMs).toBe((plannedMin - 8 * 60) * MINUTE_MS)
      // One heavy day inside an otherwise free week stays within at week level.
      expect(a.weekLevel).toBe('within')
    },
  )

  it('commitmentAdvisory_LifeAndProtectedCommitments_ReducePlannable', () => {
    // Day 0 carries 2 h life + 1 h protected → the week is honestly 37 h, so 38 h of
    // planned focus is 1 h over even though it fits the raw 40 h target.
    const w = week(5, 8, {
      0: [
        { kind: 'life', startMin: 16 * 60, endMin: 18 * 60 },
        { kind: 'protected', startMin: 8 * 60, endMin: 9 * 60 },
      ],
    })
    const a = commitmentAdvisory(w, [focus(38 * 60)])
    expect(a.weekOverageMs).toBe(1 * HOUR_MS)
    expect(a.weekLevel).toBe('over')
  })

  it('commitmentAdvisory_OverWeek_ReliefOrderedLargestMovableFirst', () => {
    const blocks: AdvisoryBlock[] = [
      focus(60), // index 0 → movable 45 min (shrinkable down to the 15-min floor)
      { kind: 'life', startMin: 960, lenMin: 90 }, // index 1 → movable 90 min (fully movable)
      focus(240), // index 2 → movable 225 min
      { kind: 'meeting', startMin: 600, lenMin: 120 }, // never relief
      { kind: 'break', startMin: 720, lenMin: 30 }, // rest, never relief
    ]
    const a = commitmentAdvisory(week(1, 4), blocks)
    expect(a.weekLevel).toBe('over') // 60+240+120 = 7 h of load on a 4 h day
    expect(
      a.relief.map(r => ({ blockId: r.blockId, kind: r.kind, movableMs: r.movableMs })),
    ).toEqual([
      { blockId: '2', kind: 'focus', movableMs: 225 * MINUTE_MS },
      { blockId: '1', kind: 'life', movableMs: 90 * MINUTE_MS },
      { blockId: '0', kind: 'focus', movableMs: 45 * MINUTE_MS },
    ])
  })

  it('commitmentAdvisory_ProtectedAndFloorSizedBlocks_NeverOfferedAsRelief', () => {
    const blocks: AdvisoryBlock[] = [
      focus(300, { protectedFlag: true }), // shielded 🛡 — untouchable
      { kind: 'life', startMin: 960, lenMin: 60, protectedFlag: true }, // shielded life
      focus(15), // already at the 15-min shrink floor → nothing movable
      focus(120),
    ]
    const a = commitmentAdvisory(week(1, 2), blocks)
    expect(a.weekLevel).toBe('over')
    expect(a.relief).toEqual([{ blockId: '3', kind: 'focus', movableMs: 105 * MINUTE_MS }])
  })

  it('commitmentAdvisory_MeetingsCountAsLoadButNeverAsRelief', () => {
    // 6 h of meetings alone overbook a 4 h day — and still no relief is offered on them.
    const a = commitmentAdvisory(week(1, 4), [{ kind: 'meeting', startMin: 480, lenMin: 360 }])
    expect(a.weekLevel).toBe('over')
    expect(a.weekOverageMs).toBe(2 * HOUR_MS)
    expect(a.relief).toEqual([])
  })

  it('commitmentAdvisory_LifeBlocksAreReliefOnly_NeverPlannedLoad', () => {
    // A life block's capacity cost lives in `week` (built from the same source); counting
    // it as planned load too would double-book the person against themselves.
    const a = commitmentAdvisory(week(1, 8), [{ kind: 'life', startMin: 960, lenMin: 120 }])
    expect(a.weekOverageMs).toBe(-8 * HOUR_MS)
    expect(a.weekLevel).toBe('within')
  })

  it('commitmentAdvisory_WithinWeekAndDay_ReliefIsEmpty', () => {
    const a = commitmentAdvisory(week(5, 8), [focus(120), focus(300, { day: 1 })])
    expect(a.weekLevel).toBe('within')
    expect(a.dayLevel).toBe('within')
    // Nothing is overbooked → a care buddy proposes no cuts at all (no nag).
    expect(a.relief).toEqual([])
  })

  it('commitmentAdvisory_DayIndexOutOfRange_CountsAtWeekLevelOnly', () => {
    const a = commitmentAdvisory(week(1, 1), [focus(120, { day: 7 })])
    expect(a.weekOverageMs).toBe(1 * HOUR_MS)
    expect(a.weekLevel).toBe('over')
    expect(a.dayOverageMs).toBe(-1 * HOUR_MS) // the one real day stays free
    expect(a.dayLevel).toBe('within')
  })

  it('commitmentAdvisory_ZeroOrNegativeLengthBlocks_AreIgnored', () => {
    const a = commitmentAdvisory(week(1, 8), [focus(0), focus(-30)])
    expect(a.weekOverageMs).toBe(-8 * HOUR_MS)
    expect(a.relief).toEqual([])
  })

  it('commitmentAdvisory_CustomZeroTolerance_AnyOverageIsOver', () => {
    const a = commitmentAdvisory(week(1, 1), [focus(61)], 0)
    expect(a.weekLevel).toBe('over')
    expect(a.weekOverageMs).toBe(1 * MINUTE_MS)
  })

  it('DEFAULT_OVERCOMMIT_TOLERANCE_MS_IsThirtyMinutes', () => {
    expect(DEFAULT_OVERCOMMIT_TOLERANCE_MS).toBe(30 * MINUTE_MS)
  })
})
