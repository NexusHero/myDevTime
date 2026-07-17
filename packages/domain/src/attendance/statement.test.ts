import { describe, expect, it } from 'vitest'
import { HOUR_MS, MINUTE_MS, zonedTimeToInstant } from '../tracking/time.js'
import type { Absence } from '../absences/absence.js'
import type { Shift, WeeklyTarget } from './worktime.js'
import { buildMonthlyStatement } from './statement.js'

/**
 * Acceptance for the monthly work-time statement (REQ-052, design v13 X). It renders one
 * calendar month of real punch events into begin/pause/end + ± + a cumulative balance
 * that runs from a carryover to a closing figure. Absence days are credited but unpunched.
 */
const TZ = 'UTC'
const EIGHT_H = 8 * HOUR_MS
const target: WeeklyTarget = [EIGHT_H, EIGHT_H, EIGHT_H, EIGHT_H, EIGHT_H, EIGHT_H, EIGHT_H]

function shiftOn(
  day: number,
  from: { h: number; m: number },
  to: { h: number; m: number },
  breakMin: number,
): Shift {
  return {
    start: zonedTimeToInstant(
      { year: 2026, month: 3, day, hour: from.h, minute: from.m, second: 0 },
      TZ,
    ),
    end: zonedTimeToInstant({ year: 2026, month: 3, day, hour: to.h, minute: to.m, second: 0 }, TZ),
    breakMs: breakMin * MINUTE_MS,
  }
}

/** Mar 2: 09:00–17:30 with a 30m pause = 8h net. */
const MAR2 = shiftOn(2, { h: 9, m: 0 }, { h: 17, m: 30 }, 30)

const vacationMar3: Absence = {
  kind: 'vacation',
  startDate: '2026-03-03',
  endDate: '2026-03-03',
  halfDay: false,
}

function build(over: Partial<Parameters<typeof buildMonthlyStatement>[0]> = {}) {
  return buildMonthlyStatement({
    year: 2026,
    month: 3,
    tz: TZ,
    // Mar 2: 09:00–17:30 with 30m pause = 8h net.
    shifts: [MAR2],
    target,
    absences: [vacationMar3],
    breakPreset: [],
    carryoverMs: 10 * HOUR_MS,
    ...over,
  })
}

describe('buildMonthlyStatement', () => {
  it('CoversEveryLocalDayOfTheMonth', () => {
    const s = build()
    expect(s.days).toHaveLength(31) // March
    expect(s.from).toBe('2026-03-01')
    expect(s.to).toBe('2026-03-31')
  })

  it('RecordsPunchColumnsForAWorkedDay', () => {
    const mar2 = build().days.find(d => d.date === '2026-03-02')
    expect(mar2?.actualMs).toBe(8 * HOUR_MS)
    expect(mar2?.pauseMs).toBe(30 * MINUTE_MS)
    expect(mar2?.beginMs).toBe(MAR2.start)
    expect(mar2?.endMs).toBe(MAR2.end)
    expect(mar2?.deltaMs).toBe(0) // 8h worked − 8h target
  })

  it('CreditsAnAbsenceDayWithoutAPunch', () => {
    const mar3 = build().days.find(d => d.date === '2026-03-03')
    expect(mar3?.absence).toBe('vacation')
    expect(mar3?.creditedMs).toBe(EIGHT_H)
    expect(mar3?.actualMs).toBe(0)
    expect(mar3?.deltaMs).toBe(0) // credited target
    expect(mar3?.beginMs).toBeNull()
  })

  it('ThreadsACumulativeBalanceFromCarryoverToClosing', () => {
    const s = build()
    const last = s.days[s.days.length - 1]
    expect(s.carryoverMs).toBe(10 * HOUR_MS)
    expect(last?.cumulativeMs).toBe(s.closingBalanceMs)
    expect(s.closingBalanceMs).toBe(s.carryoverMs + s.periodDeltaMs)
    // First day's cumulative already includes the carryover.
    expect(s.days[0]?.cumulativeMs).toBe(s.carryoverMs + (s.days[0]?.deltaMs ?? 0))
  })

  it('CountsWorkedDaysAndAbsences', () => {
    const s = build()
    expect(s.workedDays).toBe(1)
    expect(s.absenceDaysByKind.vacation).toBe(1)
  })

  it('DefaultsCarryoverToZero', () => {
    const s = buildMonthlyStatement({
      year: 2026,
      month: 3,
      tz: TZ,
      shifts: [MAR2],
      target,
      absences: [vacationMar3],
      breakPreset: [],
    })
    expect(s.carryoverMs).toBe(0)
    expect(s.closingBalanceMs).toBe(s.periodDeltaMs)
  })

  it('RollsIntoDecemberBoundaryCorrectly', () => {
    const s = buildMonthlyStatement({
      year: 2026,
      month: 12,
      tz: TZ,
      shifts: [],
      target,
      absences: [],
      breakPreset: [],
    })
    expect(s.days).toHaveLength(31)
    expect(s.to).toBe('2026-12-31')
  })

  it('RejectsAnInvalidMonth', () => {
    expect(() =>
      buildMonthlyStatement({
        year: 2026,
        month: 13,
        tz: TZ,
        shifts: [],
        target,
        absences: [],
        breakPreset: [],
      }),
    ).toThrow()
  })
})
