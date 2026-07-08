import { describe, expect, it } from 'vitest'
import { costOf, hoursToMs, sumMoney } from './money.js'
import { HOUR_MS } from '../tracking/time.js'

/**
 * Money path (REQ-005, ADR-0005): exact integer minor units, BigInt cost
 * division, explicit rounding — no float ever touches an amount.
 */
describe('costOf', () => {
  it('CostOf_WholeHourAtRate_IsExact', () => {
    expect(costOf(6000, HOUR_MS)).toBe(6000) // 60.00/h for 1h
  })

  it('CostOf_HalfHour_IsHalfTheRate', () => {
    expect(costOf(6000, HOUR_MS / 2)).toBe(3000)
  })

  it('CostOf_RoundHalfUp_AtExactMidpoint', () => {
    // 1 minor/h for half an hour → 0.5 minor → rounds up to 1.
    expect(costOf(1, HOUR_MS / 2, 'round')).toBe(1)
    expect(costOf(1, HOUR_MS / 2, 'floor')).toBe(0)
    expect(costOf(1, HOUR_MS / 2, 'ceil')).toBe(1)
  })

  it('CostOf_TinyRemainder_RoundsToZeroButCeilsToOne', () => {
    expect(costOf(1, 1, 'round')).toBe(0)
    expect(costOf(1, 1, 'floor')).toBe(0)
    expect(costOf(1, 1, 'ceil')).toBe(1)
  })

  it('CostOf_LargeValues_StayExactViaBigInt', () => {
    // A year at 1,000.00/h — beyond float-safe multiplication, exact here.
    const year = 365 * 24 * HOUR_MS
    expect(costOf(100000, year)).toBe(100000 * 365 * 24)
  })

  it('CostOf_NegativeOrNonInteger_Throws', () => {
    expect(() => costOf(-1, HOUR_MS)).toThrow(/non-negative/)
    expect(() => costOf(100, -5)).toThrow(/non-negative/)
    expect(() => costOf(1.5, HOUR_MS)).toThrow(/integer/)
  })
})

describe('sumMoney', () => {
  it('SumMoney_IntegerAmounts_AddsExactly', () => {
    expect(sumMoney([100, 250, 33])).toBe(383)
    expect(sumMoney([])).toBe(0)
  })
  it('SumMoney_NonInteger_Throws', () => {
    expect(() => sumMoney([1, 2.2])).toThrow(/integer/)
  })
})

describe('hoursToMs', () => {
  it('HoursToMs_WholeHours_Converts', () => {
    expect(hoursToMs(2)).toBe(2 * HOUR_MS)
    expect(hoursToMs(0.5)).toBe(HOUR_MS / 2)
  })
})
