import { describe, expect, it } from 'vitest'
import { plannedWorkMinutes, priceWeekFromBlocks } from './weekPrice.js'

/** Planner in-canvas Price-of-week glue (design v13 G1): planned minutes → the solver. */
describe('plannedWorkMinutes', () => {
  it('SumsEveryBlockExceptBreaks', () => {
    const blocks = [
      { kind: 'actual', len: 120 },
      { kind: 'meeting', len: 60 },
      { kind: 'ghost', len: 90 },
      { kind: 'break', len: 30 }, // excluded
    ]
    expect(plannedWorkMinutes(blocks)).toBe(270)
  })
  it('ClampsNegativeLengths', () => {
    expect(plannedWorkMinutes([{ kind: 'actual', len: -10 }])).toBe(0)
  })
})

describe('priceWeekFromBlocks', () => {
  it('PricesAllThreeIntensitiesFromPlannedWork', () => {
    const prices = priceWeekFromBlocks([{ kind: 'actual', len: 30 * 60 }]) // 30h
    expect(prices.map(p => p.intensity)).toEqual(['sustainable', 'balanced', 'dense'])
    // Dense packs into no more days than sustainable.
    expect(prices[2]?.activeDays).toBeLessThanOrEqual(prices[0]?.activeDays ?? 0)
  })
  it('IsEmptyWithNoPlannedWork', () => {
    expect(priceWeekFromBlocks([{ kind: 'break', len: 30 }])).toEqual([])
  })
})
