import { describe, expect, it } from 'vitest'
import { HOUR_MS, MINUTE_MS } from '../tracking/time.js'
import {
  committedMinutes,
  dayCapacity,
  overbookedMs,
  weekCapacity,
  type Commitment,
  type CapacityDay,
} from './plannable.js'

/**
 * Acceptance for the capacity-honesty core (REQ-055, design v14 §F Stufe 2). The
 * true plannable capacity of a day/week is the contracted target minus the person's
 * own life/protected commitments — "KW32 nur 24h". Pure, deterministic (ADR-0005);
 * Fill-week, the overbooking warning and the quote calculator all plan against *this*
 * number, never the raw target.
 */
describe('committedMinutes', () => {
  const life = (startMin: number, endMin: number): Commitment => ({
    kind: 'life',
    startMin,
    endMin,
  })

  it('SumsNonOverlappingBlocks', () => {
    expect(committedMinutes([life(540, 600), life(720, 780)])).toBe(120)
  })

  it('MergesOverlappingBlocksSoTimeIsNotDoubleCounted', () => {
    // 09:00–11:00 and 10:00–12:00 overlap → 3h covered, not 4h.
    expect(committedMinutes([life(540, 660), life(600, 720)])).toBe(180)
  })

  it('MergesAdjacentBlocks', () => {
    expect(committedMinutes([life(540, 600), life(600, 660)])).toBe(120)
  })

  it('CountsProtectedLifeAlongsideLife', () => {
    const protectedBlock: Commitment = { kind: 'protected', startMin: 720, endMin: 780 }
    expect(committedMinutes([life(540, 600), protectedBlock])).toBe(120)
  })

  it('DropsZeroAndInvertedIntervals', () => {
    expect(committedMinutes([life(540, 540), life(700, 600)])).toBe(0)
  })

  it('IsZeroForNoCommitments', () => {
    expect(committedMinutes([])).toBe(0)
  })
})

describe('dayCapacity', () => {
  it('SubtractsCommittedLifeFromTheTarget', () => {
    const day: CapacityDay = {
      targetMs: 8 * HOUR_MS,
      commitments: [{ kind: 'life', startMin: 900, endMin: 1020 }], // 15:00–17:00, 2h
    }
    const cap = dayCapacity(day)
    expect(cap.committedMs).toBe(2 * HOUR_MS)
    expect(cap.plannableMs).toBe(6 * HOUR_MS)
    expect(cap.targetMs).toBe(8 * HOUR_MS)
  })

  it('ClampsPlannableAtZeroWhenLifeExceedsTarget', () => {
    const day: CapacityDay = {
      targetMs: 2 * HOUR_MS,
      commitments: [{ kind: 'life', startMin: 540, endMin: 780 }], // 4h
    }
    expect(dayCapacity(day).plannableMs).toBe(0)
  })

  it('LeavesTheFullTargetPlannableWithNoCommitments', () => {
    expect(dayCapacity({ targetMs: 500 * MINUTE_MS, commitments: [] }).plannableMs).toBe(
      500 * MINUTE_MS,
    )
  })

  it('RejectsNegativeTarget', () => {
    expect(() => dayCapacity({ targetMs: -1, commitments: [] })).toThrow()
  })

  it('RejectsOutOfRangeCommitment', () => {
    expect(() =>
      dayCapacity({ targetMs: HOUR_MS, commitments: [{ kind: 'life', startMin: -5, endMin: 60 }] }),
    ).toThrow()
    expect(() =>
      dayCapacity({
        targetMs: HOUR_MS,
        commitments: [{ kind: 'life', startMin: 60, endMin: 1500 }],
      }),
    ).toThrow()
  })
})

describe('weekCapacity', () => {
  it('AggregatesTheHonestWeek_KW32Only24h', () => {
    // Contract 40h; 16h of life/protected across the week → 24h truly plannable.
    const workday = (lifeMin: number): CapacityDay => ({
      targetMs: 8 * HOUR_MS,
      commitments: lifeMin > 0 ? [{ kind: 'life', startMin: 540, endMin: 540 + lifeMin }] : [],
    })
    const week = weekCapacity([
      workday(3 * 60 + 12), // Mon: 3h12 life
      workday(3 * 60 + 12), // Tue
      workday(3 * 60 + 12), // Wed
      workday(3 * 60 + 12), // Thu
      workday(3 * 60 + 12), // Fri  → 5 × 3h12 = 16h life
    ])
    expect(week.targetMs).toBe(40 * HOUR_MS)
    expect(week.committedMs).toBe(16 * HOUR_MS)
    expect(week.plannableMs).toBe(24 * HOUR_MS)
    expect(week.days).toHaveLength(5)
  })

  it('IsEmptyForNoDays', () => {
    const week = weekCapacity([])
    expect(week.plannableMs).toBe(0)
    expect(week.targetMs).toBe(0)
    expect(week.days).toEqual([])
  })
})

describe('overbookedMs', () => {
  it('IsPositiveOnlyWhenPlannedWorkExceedsTruePlannable', () => {
    expect(overbookedMs({ plannableMs: 6 * HOUR_MS }, 7 * HOUR_MS)).toBe(HOUR_MS)
    expect(overbookedMs({ plannableMs: 6 * HOUR_MS }, 6 * HOUR_MS)).toBe(0)
    expect(overbookedMs({ plannableMs: 6 * HOUR_MS }, 4 * HOUR_MS)).toBe(0)
  })
})
