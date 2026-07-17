import { describe, expect, it } from 'vitest'
import { HOUR_MS } from '../tracking/time.js'
import {
  priceWeek,
  priceWeekAt,
  weekLoadFromMinutes,
  type WeekLoadInput,
} from './week-price.js'

/**
 * Acceptance for Price of the week (REQ-050, design v13 G1). The solver trades peak-day
 * strain for free days across three intensities, all rule-based (ADR-0005).
 */
const base: WeekLoadInput = {
  totalWorkMs: 30 * HOUR_MS,
  availableDays: 5,
  targetDailyMs: 8 * HOUR_MS,
  billableWorkMs: 24 * HOUR_MS,
  ratePerHourMinor: 10_000, // 100.00 / h
}

describe('priceWeekAt', () => {
  it('SustainableSpreadsAcrossMoreDaysThanDense', () => {
    const sustainable = priceWeekAt(base, 'sustainable')
    const dense = priceWeekAt(base, 'dense')
    expect(sustainable.activeDays).toBeGreaterThanOrEqual(dense.activeDays)
    expect(dense.freeDays).toBeGreaterThanOrEqual(sustainable.freeDays)
  })

  it('DenseCarriesAHigherPerDayLoadAndStrain', () => {
    const sustainable = priceWeekAt(base, 'sustainable')
    const dense = priceWeekAt(base, 'dense')
    expect(dense.perDayMs).toBeGreaterThanOrEqual(sustainable.perDayMs)
    expect(dense.loadScore).toBeGreaterThanOrEqual(sustainable.loadScore)
  })

  it('PricesRevenueFromBillableHoursIndependentOfIntensity', () => {
    const [s, b, d] = priceWeek(base)
    // 24 billable hours × 100.00/h = 2400.00 = 240000 minor.
    expect(s?.revenueMinor).toBe(240_000)
    expect(b?.revenueMinor).toBe(240_000)
    expect(d?.revenueMinor).toBe(240_000)
  })

  it('ReportsNoOvertimeWhenWorkFitsWithinTarget', () => {
    // 30h over 5 days = 6h/day, under an 8h target → no overtime, low strain.
    const s = priceWeekAt(base, 'sustainable')
    expect(s.activeDays).toBe(5)
    expect(s.overtimeMs).toBe(0)
    expect(s.loadScore).toBe(0)
  })

  it('SurfacesOvertimeWhenPackedIntoFewDays', () => {
    // 45h of work: dense packs it tighter and incurs overtime beyond the 8h target.
    const heavy: WeekLoadInput = { ...base, totalWorkMs: 45 * HOUR_MS, billableWorkMs: 45 * HOUR_MS }
    const dense = priceWeekAt(heavy, 'dense')
    expect(dense.overtimeMs).toBeGreaterThan(0)
    expect(dense.loadScore).toBeGreaterThan(0)
  })

  it('OverflowsHonestlyWhenWorkExceedsEvenFullStretch', () => {
    // 60h can't fit 5×(8×1.6=12.8h)=64h? it can — push to 80h to force overflow.
    const overflow: WeekLoadInput = { ...base, totalWorkMs: 80 * HOUR_MS, billableWorkMs: 80 * HOUR_MS }
    const dense = priceWeekAt(overflow, 'dense')
    expect(dense.activeDays).toBe(5) // clamped to availableDays
    expect(dense.perDayMs).toBe(16 * HOUR_MS)
    expect(dense.overtimeMs).toBe(5 * 8 * HOUR_MS) // 8h over target each day
  })

  it('ReturnsAZeroPriceForNoWork', () => {
    const none = priceWeekAt({ ...base, totalWorkMs: 0, billableWorkMs: 0 }, 'balanced')
    expect(none.activeDays).toBe(0)
    expect(none.perDayMs).toBe(0)
    expect(none.revenueMinor).toBe(0)
    expect(none.freeDays).toBe(5)
  })

  it('ValidatesItsInputs', () => {
    expect(() => priceWeekAt({ ...base, availableDays: 0 }, 'balanced')).toThrow()
    expect(() => priceWeekAt({ ...base, targetDailyMs: 0 }, 'balanced')).toThrow()
    expect(() => priceWeekAt({ ...base, billableWorkMs: 999 * HOUR_MS }, 'balanced')).toThrow()
  })
})

describe('weekLoadFromMinutes', () => {
  it('ConvertsMinutesToTheMsLoadInput', () => {
    const input = weekLoadFromMinutes({
      totalWorkMin: 1_800,
      availableDays: 5,
      targetDailyMin: 480,
      billableWorkMin: 1_440,
      ratePerHourMinor: 10_000,
    })
    expect(input).toEqual(base)
  })
})

describe('priceWeek', () => {
  it('ReturnsAllThreeIntensitiesSustainableToDense', () => {
    const all = priceWeek(base)
    expect(all.map(p => p.intensity)).toEqual(['sustainable', 'balanced', 'dense'])
  })
})
