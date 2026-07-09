import { describe, expect, it } from 'vitest'
import { plannerBlockRect, plannerTotalHours } from './planner.js'

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
