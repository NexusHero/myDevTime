import { describe, expect, it } from 'vitest'
import { HOUR_MS } from '../tracking/time.js'
import { effectiveRate, perHourRate } from './effective-rate.js'

/**
 * Acceptance for effective-rate truth (REQ-048, design v13 G2). The effective rate
 * divides revenue by *every* tracked hour, so it lands below the nominal rate whenever
 * unbilled time exists — the honest number the Reports screen shows.
 */
describe('perHourRate', () => {
  it('DividesRevenueByHoursExactly', () => {
    // 10h at 12000 minor total → 1200/h.
    expect(perHourRate(12_000, 10 * HOUR_MS)).toBe(1_200)
  })
  it('RoundsHalfUpInMinorUnits', () => {
    // 10000 minor over 3h = 3333.33 → 3333.
    expect(perHourRate(10_000, 3 * HOUR_MS)).toBe(3_333)
  })
  it('IsNullForZeroDuration', () => {
    expect(perHourRate(5_000, 0)).toBeNull()
  })
  it('RejectsNegativeInputs', () => {
    expect(() => perHourRate(-1, HOUR_MS)).toThrow()
    expect(() => perHourRate(1, -HOUR_MS)).toThrow()
  })
})

describe('effectiveRate', () => {
  it('EffectiveIsBelowNominalWhenUnbilledTimeExists', () => {
    // 12000 minor earned on 6 billable hours out of 10 tracked.
    const r = effectiveRate(12_000, 6 * HOUR_MS, 10 * HOUR_MS)
    expect(r.nominalPerHourMinor).toBe(2_000) // 12000 / 6
    expect(r.effectivePerHourMinor).toBe(1_200) // 12000 / 10
    expect(r.utilization).toBeCloseTo(0.6)
  })
  it('EffectiveEqualsNominalAtFullUtilization', () => {
    const r = effectiveRate(8_000, 8 * HOUR_MS, 8 * HOUR_MS)
    expect(r.effectivePerHourMinor).toBe(r.nominalPerHourMinor)
    expect(r.utilization).toBe(1)
  })
  it('HandlesNoTrackedTimeHonestly', () => {
    const r = effectiveRate(0, 0, 0)
    expect(r.nominalPerHourMinor).toBeNull()
    expect(r.effectivePerHourMinor).toBeNull()
    expect(r.utilization).toBe(0)
  })
  it('RejectsTrackedLessThanBillable', () => {
    expect(() => effectiveRate(1_000, 5 * HOUR_MS, 3 * HOUR_MS)).toThrow()
  })
})
