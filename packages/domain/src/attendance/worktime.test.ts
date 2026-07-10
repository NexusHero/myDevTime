import { describe, expect, it } from 'vitest'
import { HOUR_MS, MINUTE_MS, zonedTimeToInstant } from '../tracking/time.js'
import {
  computeOvertime,
  isValidShift,
  shiftNetMs,
  targetForDay,
  type Shift,
  type WeeklyTarget,
} from './worktime.js'

/**
 * The attendance work-day core (REQ-028, ADR-0010): net worked time per shift and
 * the overtime balance against a weekly target schedule. Pure and deterministic —
 * every number the work-time report and the Reports gauge show is computed here,
 * never by an LLM (ADR-0005).
 */
const TZ = 'Europe/Berlin'
const at = (y: number, mo: number, d: number, h: number, mi = 0): number =>
  zonedTimeToInstant({ year: y, month: mo, day: d, hour: h, minute: mi, second: 0 }, TZ)

// 8h target Mon–Fri, 0 on the weekend.
const EIGHT_TO_FIVE: WeeklyTarget = [
  8 * HOUR_MS,
  8 * HOUR_MS,
  8 * HOUR_MS,
  8 * HOUR_MS,
  8 * HOUR_MS,
  0,
  0,
]

describe('shiftNetMs / isValidShift', () => {
  it('SubtractsBreaksFromTheGrossSpan', () => {
    const shift: Shift = {
      start: at(2026, 7, 6, 9),
      end: at(2026, 7, 6, 18),
      breakMs: 30 * MINUTE_MS,
    }
    expect(shiftNetMs(shift)).toBe(9 * HOUR_MS - 30 * MINUTE_MS)
    expect(isValidShift(shift)).toBe(true)
  })
  it('RejectsEndBeforeStartAndOversizedBreaks', () => {
    expect(isValidShift({ start: at(2026, 7, 6, 18), end: at(2026, 7, 6, 9), breakMs: 0 })).toBe(
      false,
    )
    expect(
      isValidShift({ start: at(2026, 7, 6, 9), end: at(2026, 7, 6, 10), breakMs: 2 * HOUR_MS }),
    ).toBe(false)
    expect(isValidShift({ start: at(2026, 7, 6, 9), end: at(2026, 7, 6, 10), breakMs: -1 })).toBe(
      false,
    )
  })
  it('NeverReturnsNegativeNet', () => {
    // A full-span break nets zero, not negative.
    expect(
      shiftNetMs({ start: at(2026, 7, 6, 9), end: at(2026, 7, 6, 10), breakMs: HOUR_MS }),
    ).toBe(0)
  })
})

describe('targetForDay', () => {
  it('PicksTheWeekdayTarget', () => {
    // 2026-07-06 is a Monday, 2026-07-11 a Saturday.
    expect(targetForDay(EIGHT_TO_FIVE, at(2026, 7, 6, 12), TZ)).toBe(8 * HOUR_MS)
    expect(targetForDay(EIGHT_TO_FIVE, at(2026, 7, 11, 12), TZ)).toBe(0)
  })
})

describe('computeOvertime', () => {
  const week = { from: at(2026, 7, 6, 0), to: at(2026, 7, 13, 0), tz: TZ }

  it('BalancesWorkedAgainstTheWeeklyTarget', () => {
    // Mon–Fri, 9h gross each with a 30m break → 8.5h net/day = 42.5h worked.
    const shifts: Shift[] = [6, 7, 8, 9, 10].map(d => ({
      start: at(2026, 7, d, 9),
      end: at(2026, 7, d, 18),
      breakMs: 30 * MINUTE_MS,
    }))
    const bal = computeOvertime(shifts, EIGHT_TO_FIVE, week)
    expect(bal.workedMs).toBe(5 * (9 * HOUR_MS - 30 * MINUTE_MS))
    expect(bal.targetMs).toBe(40 * HOUR_MS)
    expect(bal.balanceMs).toBe(5 * 30 * MINUTE_MS) // +2.5h overtime
  })

  it('IsNegativeWhenUnderTarget', () => {
    const shifts: Shift[] = [{ start: at(2026, 7, 6, 9), end: at(2026, 7, 6, 13), breakMs: 0 }]
    const bal = computeOvertime(shifts, EIGHT_TO_FIVE, week)
    expect(bal.workedMs).toBe(4 * HOUR_MS)
    expect(bal.targetMs).toBe(40 * HOUR_MS)
    expect(bal.balanceMs).toBe(4 * HOUR_MS - 40 * HOUR_MS)
  })

  it('CountsOnlyShiftsStartingInsideTheWindowAndSkipsInvalidOnes', () => {
    const shifts: Shift[] = [
      { start: at(2026, 7, 6, 9), end: at(2026, 7, 6, 17), breakMs: 0 }, // 8h, in window
      { start: at(2026, 7, 5, 9), end: at(2026, 7, 5, 17), breakMs: 0 }, // before window
      { start: at(2026, 7, 8, 18), end: at(2026, 7, 8, 9), breakMs: 0 }, // invalid
    ]
    const bal = computeOvertime(shifts, EIGHT_TO_FIVE, week)
    expect(bal.workedMs).toBe(8 * HOUR_MS)
  })

  it('SumsTargetOverEveryLocalDayTheWindowTouches', () => {
    // A single Monday window → one 8h target day.
    const oneDay = { from: at(2026, 7, 6, 0), to: at(2026, 7, 7, 0), tz: TZ }
    expect(computeOvertime([], EIGHT_TO_FIVE, oneDay).targetMs).toBe(8 * HOUR_MS)
  })

  it('EmptyWindowYieldsZeroes', () => {
    const empty = { from: at(2026, 7, 6, 0), to: at(2026, 7, 6, 0), tz: TZ }
    expect(computeOvertime([], EIGHT_TO_FIVE, empty)).toEqual({
      workedMs: 0,
      targetMs: 0,
      balanceMs: 0,
    })
  })
})
