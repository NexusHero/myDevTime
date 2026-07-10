import { describe, expect, it } from 'vitest'
import {
  absenceDays,
  coversDate,
  inclusiveDayCount,
  vacationBalance,
  type Absence,
} from './absence.js'

/**
 * The absence core (REQ-029, ADR-0010): how many days an absence spans (ranges +
 * half-days) and the vacation-allowance balance. Deterministic and pure — the
 * numbers that reach the Absences screen and the signable report are computed here
 * (ADR-0005), never by an LLM.
 */
const abs = (
  kind: Absence['kind'],
  startDate: string,
  endDate: string,
  halfDay = false,
): Absence => ({
  kind,
  startDate,
  endDate,
  halfDay,
})

describe('inclusiveDayCount', () => {
  it('CountsBothEndsInclusive', () => {
    expect(inclusiveDayCount('2026-07-14', '2026-07-17')).toBe(4)
    expect(inclusiveDayCount('2026-07-14', '2026-07-14')).toBe(1)
  })
  it('CrossesMonthAndYearBoundaries', () => {
    expect(inclusiveDayCount('2026-12-30', '2027-01-02')).toBe(4)
  })
  it('IsZeroWhenEndPrecedesStart', () => {
    expect(inclusiveDayCount('2026-07-17', '2026-07-14')).toBe(0)
  })
})

describe('absenceDays', () => {
  it('CountsAWholeRange', () => {
    expect(absenceDays(abs('vacation', '2026-07-14', '2026-07-17'))).toBe(4)
  })
  it('CountsASingleHalfDayAsHalf', () => {
    expect(absenceDays(abs('vacation', '2026-07-14', '2026-07-14', true))).toBe(0.5)
  })
  it('IgnoresTheHalfFlagOnMultiDayRanges', () => {
    expect(absenceDays(abs('vacation', '2026-07-14', '2026-07-16', true))).toBe(3)
  })
})

describe('coversDate', () => {
  it('IsInclusiveOfBothEnds', () => {
    const a = abs('vacation', '2026-07-14', '2026-07-17')
    expect(coversDate(a, '2026-07-14')).toBe(true)
    expect(coversDate(a, '2026-07-17')).toBe(true)
    expect(coversDate(a, '2026-07-13')).toBe(false)
    expect(coversDate(a, '2026-07-18')).toBe(false)
  })
})

describe('vacationBalance', () => {
  const policy = { annualAllowanceDays: 30, carryOverDays: 5 }
  it('CountsOnlyVacationAgainstTheAllowance', () => {
    const bal = vacationBalance(
      [
        abs('vacation', '2026-07-14', '2026-07-17'), // 4
        abs('vacation', '2026-08-03', '2026-08-03', true), // 0.5
        abs('sick', '2026-07-06', '2026-07-06'), // ignored
        abs('holiday', '2026-07-29', '2026-07-29'), // ignored
      ],
      policy,
    )
    expect(bal.usedDays).toBe(4.5)
    expect(bal.allowanceDays).toBe(30)
    expect(bal.carryOverDays).toBe(5)
    expect(bal.remainingDays).toBe(30 + 5 - 4.5)
  })
  it('GoesNegativeWhenOverdrawn', () => {
    const bal = vacationBalance([abs('vacation', '2026-01-01', '2026-12-31')], {
      annualAllowanceDays: 30,
      carryOverDays: 0,
    })
    expect(bal.remainingDays).toBeLessThan(0)
  })
})
