import { describe, expect, it } from 'vitest'
import {
  assignLanes,
  dayLoad,
  dropTarget,
  findFreeSlot,
  loadTone,
  maxConcurrency,
  plannerBlockRect,
  plannerTotalHours,
  priorityWeight,
  snapDurationMin,
} from './planner.js'

/**
 * The planner geometry is deterministic layout math (ADR-0005), so it is pinned
 * exhaustively: a block fully inside the window, the boundary cases (starts at 0,
 * ends exactly at the span), and the clamps for blocks that start before or run
 * past the visible window. Fractions must always stay within `[0, 1]`.
 */
describe('plannerBlockRect', () => {
  const SPAN = 600 // 08:00–18:00

  it('Block_FullyInsideWindow_MapsToProportionalFractions', () => {
    // 09:00 (60m in) for 90m of a 600m window.
    expect(plannerBlockRect(60, 90, SPAN)).toEqual({ top: 0.1, height: 0.15 })
  })

  it('Block_AtWindowStart_TopIsZero', () => {
    expect(plannerBlockRect(0, 60, SPAN)).toEqual({ top: 0, height: 0.1 })
  })

  it('Block_EndingExactlyAtSpan_HeightReachesOne', () => {
    expect(plannerBlockRect(540, 60, SPAN)).toEqual({ top: 0.9, height: 0.1 })
  })

  it('Block_StartingBeforeWindow_ClampsTopToZeroAndTrimsHeight', () => {
    // starts 30m before the window, runs 90m → visible slice is the last 60m.
    expect(plannerBlockRect(-30, 90, SPAN)).toEqual({ top: 0, height: 0.1 })
  })

  it('Block_RunningPastWindow_ClampsHeightToRemainder', () => {
    // starts at 570 (30m before the end), 120m long → only 30m visible.
    expect(plannerBlockRect(570, 120, SPAN)).toEqual({ top: 0.95, height: 0.05 })
  })

  it('Block_StartingAtOrAfterSpanEnd_HasZeroHeight', () => {
    expect(plannerBlockRect(600, 60, SPAN)).toEqual({ top: 1, height: 0 })
    expect(plannerBlockRect(700, 60, SPAN)).toEqual({ top: 1, height: 0 })
  })

  it('ZeroLengthBlock_HasZeroHeight', () => {
    expect(plannerBlockRect(120, 0, SPAN)).toEqual({ top: 0.2, height: 0 })
  })

  it('NonPositiveSpan_Throws', () => {
    expect(() => plannerBlockRect(0, 10, 0)).toThrow('spanMin must be positive')
    expect(() => plannerBlockRect(0, 10, -5)).toThrow('spanMin must be positive')
  })

  it('NegativeLength_Throws', () => {
    expect(() => plannerBlockRect(0, -1, SPAN)).toThrow('lengthMin must not be negative')
  })
})

describe('plannerTotalHours', () => {
  it('SumsMinutesIntoHours', () => {
    expect(plannerTotalHours([90, 60, 120, 90])).toBeCloseTo(6, 10)
  })

  it('EmptyDay_IsZero', () => {
    expect(plannerTotalHours([])).toBe(0)
  })
})

describe('priorityWeight', () => {
  it('HighPriorityWeighsHeavier', () => {
    expect(priorityWeight(1)).toBe(1.4)
    expect(priorityWeight(2)).toBe(1)
    expect(priorityWeight(3)).toBe(0.7)
  })
})

describe('dayLoad', () => {
  it('SumsPrioWeightedEstimates', () => {
    // 3h @ P1 (×1.4) + 2h @ P2 (×1) + 1h @ P3 (×0.7) = 4.2 + 2 + 0.7 = 6.9
    expect(
      dayLoad([
        { prio: 1, estHours: 3 },
        { prio: 2, estHours: 2 },
        { prio: 3, estHours: 1 },
      ]),
    ).toBeCloseTo(6.9, 10)
  })

  it('EmptyDay_IsZero', () => {
    expect(dayLoad([])).toBe(0)
  })

  it('NegativeEstimate_IsFlooredAtZero', () => {
    expect(dayLoad([{ prio: 1, estHours: -5 }])).toBe(0)
  })
})

describe('loadTone', () => {
  const SOLL = 8
  it('NoLoad_IsIdle', () => {
    expect(loadTone(0, SOLL)).toBe('idle')
  })
  it('UpTo85Percent_IsGood', () => {
    expect(loadTone(SOLL * 0.85, SOLL)).toBe('good')
  })
  it('Between85AndSoll_IsWarn', () => {
    expect(loadTone(SOLL * 0.95, SOLL)).toBe('warn')
    expect(loadTone(SOLL, SOLL)).toBe('warn')
  })
  it('OverSoll_IsCrit', () => {
    expect(loadTone(SOLL + 0.1, SOLL)).toBe('crit')
  })
  it('NonPositiveSoll_WithLoad_IsCrit', () => {
    expect(loadTone(3, 0)).toBe('crit')
  })
})

describe('snapDurationMin', () => {
  it('RoundsToTheNearestGridStep', () => {
    expect(snapDurationMin(52, 15)).toBe(45) // 52 → nearest 15 is 45
    expect(snapDurationMin(53, 15)).toBe(60) // 53 → nearest 15 is 60
  })
  it('ClampsToMinimum', () => {
    expect(snapDurationMin(3, 15, 15)).toBe(15)
    expect(snapDurationMin(-100, 15, 15)).toBe(15)
  })
  it('ClampsToMaximum_NeverBelowMin', () => {
    expect(snapDurationMin(600, 15, 15, 120)).toBe(120)
    // A max below the min still yields at least the min (window smaller than a slot).
    expect(snapDurationMin(600, 15, 30, 10)).toBe(30)
  })
  it('NonPositiveGrid_Throws', () => {
    expect(() => snapDurationMin(60, 0)).toThrow('gridMin must be positive')
  })
})

describe('assignLanes', () => {
  it('NonOverlappingBlocks_AreAllFullWidth', () => {
    const p = assignLanes([
      { startMin: 0, lenMin: 60 },
      { startMin: 60, lenMin: 60 },
      { startMin: 120, lenMin: 60 },
    ])
    expect(p).toEqual([
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
    ])
  })

  it('TwoOverlappingBlocks_SplitIntoTwoLanes', () => {
    // Both 09:00–10:00-ish overlap → cluster of 2 lanes.
    const p = assignLanes([
      { startMin: 0, lenMin: 60 },
      { startMin: 30, lenMin: 60 },
    ])
    expect(p).toEqual([
      { lane: 0, lanes: 2 },
      { lane: 1, lanes: 2 },
    ])
  })

  it('PreservesInputOrder_RegardlessOfStartOrder', () => {
    // Later-starting block passed first; placement array still aligns to input.
    const p = assignLanes([
      { startMin: 30, lenMin: 60 },
      { startMin: 0, lenMin: 60 },
    ])
    // Input[1] starts first → lane 0; input[0] → lane 1. Both in a 2-lane cluster.
    expect(p).toEqual([
      { lane: 1, lanes: 2 },
      { lane: 0, lanes: 2 },
    ])
  })

  it('FreedLaneIsReused_WhenAnEarlierBlockHasEnded', () => {
    // A: 0–120 (lane 0). B: 0–60 (lane 1). C: 60–120 reuses lane 1 (B ended).
    const p = assignLanes([
      { startMin: 0, lenMin: 120 },
      { startMin: 0, lenMin: 60 },
      { startMin: 60, lenMin: 60 },
    ])
    expect(p).toEqual([
      { lane: 0, lanes: 2 },
      { lane: 1, lanes: 2 },
      { lane: 1, lanes: 2 },
    ])
  })

  it('TouchingBlocks_DoNotOverlap', () => {
    const p = assignLanes([
      { startMin: 0, lenMin: 60 },
      { startMin: 60, lenMin: 60 },
    ])
    expect(p).toEqual([
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
    ])
  })

  it('EmptyInput_IsEmpty', () => {
    expect(assignLanes([])).toEqual([])
  })
})

describe('dropTarget', () => {
  const OPTS = { colWidth: 100, minPerPx: 1, dayCount: 5, spanMin: 600, gridMin: 15 }
  const FROM = { day: 1, startMin: 120, lenMin: 60 }

  it('NoDelta_StaysPut', () => {
    expect(dropTarget(0, 0, FROM, OPTS)).toEqual({ day: 1, startMin: 120 })
  })

  it('HorizontalDelta_MovesWholeDaySteps', () => {
    // +250px over a 100px column → round(2.5)=3 (banker-agnostic Math.round → 3) day steps → day 4.
    expect(dropTarget(250, 0, FROM, OPTS).day).toBe(4)
    // −100px → one day left → day 0.
    expect(dropTarget(-100, 0, FROM, OPTS).day).toBe(0)
  })

  it('DayStep_ClampsToTheWeek', () => {
    expect(dropTarget(1000, 0, FROM, OPTS).day).toBe(4)
    expect(dropTarget(-1000, 0, FROM, OPTS).day).toBe(0)
  })

  it('VerticalDelta_SnapsStartToTheGrid', () => {
    // +52px at 1 min/px → 120+52=172 → nearest 15 = 165.
    expect(dropTarget(0, 52, FROM, OPTS).startMin).toBe(165)
  })

  it('Start_ClampsSoTheBlockStaysInsideTheDay', () => {
    // A huge downward drag can't push a 60-min block past 540 (600−60).
    expect(dropTarget(0, 10_000, FROM, OPTS).startMin).toBe(540)
    // A huge upward drag floors the start at 0.
    expect(dropTarget(0, -10_000, FROM, OPTS).startMin).toBe(0)
  })

  it('ZeroColumnWidth_KeepsTheDay', () => {
    expect(dropTarget(500, 0, FROM, { ...OPTS, colWidth: 0 }).day).toBe(1)
  })
})

describe('findFreeSlot', () => {
  const DAY_START = 0
  const DAY_END = 600 // 08:00–18:00

  it('EmptyDay_ReturnsTheWindowStart', () => {
    expect(findFreeSlot([], 60, DAY_START, DAY_END)).toBe(0)
  })

  it('FitsIntoTheFirstGapAfterAnEarlyBlock', () => {
    // A block 0–120; a 60-min task lands right after it, at 120.
    expect(findFreeSlot([{ startMin: 0, lenMin: 120 }], 60, DAY_START, DAY_END)).toBe(120)
  })

  it('SlotsIntoAGapBetweenTwoBlocks', () => {
    const occ = [
      { startMin: 0, lenMin: 60 },
      { startMin: 180, lenMin: 60 },
    ]
    // 60–180 is free; a 60-min task takes 60.
    expect(findFreeSlot(occ, 60, DAY_START, DAY_END)).toBe(60)
  })

  it('RespectsNotBefore_SkippingElapsedTime', () => {
    expect(findFreeSlot([], 60, DAY_START, DAY_END, 200)).toBe(200)
  })

  it('ReturnsNull_WhenTheDayCannotHoldIt', () => {
    // One block fills all but the last 30 min; a 60-min task can't fit.
    expect(findFreeSlot([{ startMin: 0, lenMin: 570 }], 60, DAY_START, DAY_END)).toBeNull()
  })
})

describe('maxConcurrency', () => {
  it('NoBlocks_IsZero', () => {
    expect(maxConcurrency([])).toBe(0)
  })

  it('SequentialBlocks_PeakIsOne', () => {
    expect(
      maxConcurrency([
        { startMin: 0, lenMin: 60 },
        { startMin: 60, lenMin: 60 },
      ]),
    ).toBe(1)
  })

  it('ThreeWayOverlap_PeaksAtThree', () => {
    expect(
      maxConcurrency([
        { startMin: 0, lenMin: 120 },
        { startMin: 30, lenMin: 60 },
        { startMin: 45, lenMin: 60 },
      ]),
    ).toBe(3)
  })

  it('ZeroLengthBlocks_DoNotCount', () => {
    expect(
      maxConcurrency([
        { startMin: 0, lenMin: 0 },
        { startMin: 0, lenMin: 60 },
      ]),
    ).toBe(1)
  })
})
