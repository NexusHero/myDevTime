import { describe, expect, it } from 'vitest'
import { HOUR_MS, MINUTE_MS } from '../tracking/time.js'
import {
  ARBZG_PRESET,
  breakShortfallMs,
  hasBreakViolation,
  requiredBreakMs,
  type Shift,
} from './index.js'

/**
 * The configurable break-rule check (REQ-028, ADR-0010) — the German ArbZG §4
 * preset: >6h worked requires ≥30 min break, >9h requires ≥45 min. A hint engine,
 * not legal certification (ADR-0010): deterministic and pure, it surfaces the
 * shortfall as a warning.
 */
const shift = (grossHours: number, breakMin: number): Shift => ({
  start: 0,
  end: grossHours * HOUR_MS,
  breakMs: breakMin * MINUTE_MS,
})

describe('requiredBreakMs (ArbZG §4 preset)', () => {
  it('IsZeroUpToSixHours', () => {
    expect(requiredBreakMs(6 * HOUR_MS, ARBZG_PRESET)).toBe(0)
  })
  it('Is30MinutesAboveSixHours', () => {
    expect(requiredBreakMs(6 * HOUR_MS + 1, ARBZG_PRESET)).toBe(30 * MINUTE_MS)
    expect(requiredBreakMs(9 * HOUR_MS, ARBZG_PRESET)).toBe(30 * MINUTE_MS)
  })
  it('Is45MinutesAboveNineHours', () => {
    expect(requiredBreakMs(9 * HOUR_MS + 1, ARBZG_PRESET)).toBe(45 * MINUTE_MS)
    expect(requiredBreakMs(12 * HOUR_MS, ARBZG_PRESET)).toBe(45 * MINUTE_MS)
  })
})

describe('breakShortfallMs / hasBreakViolation', () => {
  it('IsZeroWhenTheBreakMeetsTheRequirement', () => {
    // 8h worked with a 30m break → compliant.
    expect(breakShortfallMs(shift(8, 30), ARBZG_PRESET)).toBe(0)
    expect(hasBreakViolation(shift(8, 30), ARBZG_PRESET)).toBe(false)
  })
  it('ReportsTheMissingMinutes', () => {
    // 8h worked with only 10m break → 20m short of the 30m rule.
    expect(breakShortfallMs(shift(8, 10), ARBZG_PRESET)).toBe(20 * MINUTE_MS)
    expect(hasBreakViolation(shift(8, 10), ARBZG_PRESET)).toBe(true)
  })
  it('UsesTheGrossSpanNotNetWorkedTime', () => {
    // 10h gross, 40m break → over 9h so needs 45m → 5m short (still a violation).
    expect(breakShortfallMs(shift(10, 40), ARBZG_PRESET)).toBe(5 * MINUTE_MS)
  })
  it('IgnoresInvalidShifts', () => {
    // end before start → not a violation (invalid shifts are skipped upstream).
    expect(hasBreakViolation({ start: HOUR_MS, end: 0, breakMs: 0 }, ARBZG_PRESET)).toBe(false)
    expect(breakShortfallMs({ start: HOUR_MS, end: 0, breakMs: 0 }, ARBZG_PRESET)).toBe(0)
  })
})
