import { describe, expect, it } from 'vitest'
import { freeWindows, type MinuteWindow } from './model.js'

/**
 * Acceptance for the shared minute-window math (ADR-0072). `freeWindows` is the one gap
 * computation both the day-repair reflow and the fill-week packing build on: obstacles are
 * clipped to the range and merged regardless of input order or overlap, inverted/zero-length
 * obstacles carry no time and are ignored, and the free windows tile exactly the range minus
 * the obstacles — no zero-length slivers.
 */
const w = (startMin: number, endMin: number): MinuteWindow => ({ startMin, endMin })

describe('freeWindows', () => {
  it('NoObstacles_TheWholeRangeIsFree', () => {
    expect(freeWindows(480, 1080, [])).toEqual([w(480, 1080)])
  })

  it('EmptyRange_HasNoFreeWindows', () => {
    expect(freeWindows(480, 480, [])).toEqual([])
    expect(freeWindows(600, 480, [w(0, 1440)])).toEqual([])
  })

  it('OneObstacleInTheMiddle_SplitsTheRange', () => {
    expect(freeWindows(480, 1080, [w(600, 660)])).toEqual([w(480, 600), w(660, 1080)])
  })

  it('ObstacleFlushWithARangeEdge_LeavesNoZeroLengthSliver', () => {
    expect(freeWindows(480, 1080, [w(480, 540)])).toEqual([w(540, 1080)])
    expect(freeWindows(480, 1080, [w(1020, 1080)])).toEqual([w(480, 1020)])
  })

  it('TouchingObstacles_MergeIntoOneBlockedStretch', () => {
    // 600–660 and 660–720 touch → one free window on either side, none between.
    expect(freeWindows(480, 1080, [w(600, 660), w(660, 720)])).toEqual([w(480, 600), w(720, 1080)])
  })

  it('OverlappingObstacles_MergeIntoOneBlockedStretch', () => {
    expect(freeWindows(480, 1080, [w(600, 700), w(650, 720)])).toEqual([w(480, 600), w(720, 1080)])
  })

  it('ObstacleContainedInAnother_ChangesNothing', () => {
    expect(freeWindows(480, 1080, [w(600, 720), w(630, 660)])).toEqual([w(480, 600), w(720, 1080)])
  })

  it('UnsortedObstacles_YieldTheSameWindowsAsSorted', () => {
    const sorted = freeWindows(480, 1080, [w(540, 570), w(600, 660), w(900, 930)])
    const shuffled = freeWindows(480, 1080, [w(900, 930), w(540, 570), w(600, 660)])
    expect(shuffled).toEqual(sorted)
    expect(sorted).toEqual([w(480, 540), w(570, 600), w(660, 900), w(930, 1080)])
  })

  it('ObstacleCoveringTheWholeRange_LeavesNothingFree', () => {
    expect(freeWindows(480, 1080, [w(480, 1080)])).toEqual([])
    expect(freeWindows(480, 1080, [w(0, 1440)])).toEqual([])
  })

  it('ObstaclesEntirelyOutsideTheRange_AreIgnored', () => {
    expect(freeWindows(480, 1080, [w(0, 480), w(1080, 1440)])).toEqual([w(480, 1080)])
  })

  it('ObstacleStraddlingARangeEdge_IsClippedToTheRange', () => {
    expect(freeWindows(480, 1080, [w(420, 540), w(1020, 1140)])).toEqual([w(540, 1020)])
  })

  it('InvertedAndZeroLengthObstacles_CarryNoTimeAndAreIgnored', () => {
    expect(freeWindows(480, 1080, [w(600, 600), w(700, 650)])).toEqual([w(480, 1080)])
  })

  it('DoesNotMutateTheObstaclesArray', () => {
    const obstacles = [w(900, 930), w(540, 570)]
    const before = obstacles.map(o => ({ ...o }))
    freeWindows(480, 1080, obstacles)
    expect(obstacles).toEqual(before)
  })
})
