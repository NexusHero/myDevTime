import { describe, expect, it } from 'vitest'
import { HOUR_MS, MINUTE_MS, zonedTimeToInstant } from '../tracking/time.js'
import { ARBZG_PRESET } from './break-rule.js'
import { buildWorktimeReport, type WorktimeReportInput } from './report.js'
import type { Shift, WeeklyTarget } from './worktime.js'
import type { Absence } from '../absences/absence.js'

/**
 * The monthly work-time report (REQ-030, ADR-0010): per-day worked / target /
 * break / absence, the totals, and the overtime balance with absence days
 * credited against the target (the REQ-029 interplay). Pure and deterministic —
 * every figure the signable PDF/XLSX prints is computed here (ADR-0005).
 */
const TZ = 'Europe/Berlin'
const at = (y: number, mo: number, d: number, h: number, mi = 0): number =>
  zonedTimeToInstant({ year: y, month: mo, day: d, hour: h, minute: mi, second: 0 }, TZ)

const EIGHT: WeeklyTarget = [8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 0, 0]

// A short window: Mon 2026-07-06 .. Wed 2026-07-08 (exclusive Thu 09).
const base = (over: Partial<WorktimeReportInput> = {}): WorktimeReportInput => ({
  from: at(2026, 7, 6, 0),
  to: at(2026, 7, 9, 0),
  tz: TZ,
  shifts: [],
  target: EIGHT,
  absences: [],
  breakPreset: ARBZG_PRESET,
  ...over,
})

const shift = (d: number, h: number, breakMin: number): Shift => ({
  start: at(2026, 7, d, 8),
  end: at(2026, 7, d, 8 + h),
  breakMs: breakMin * MINUTE_MS,
})

describe('buildWorktimeReport', () => {
  it('EmitsOneRowPerLocalDay', () => {
    const r = buildWorktimeReport(base())
    expect(r.days.map(d => d.date)).toEqual(['2026-07-06', '2026-07-07', '2026-07-08'])
    expect(r.from).toBe('2026-07-06')
    expect(r.to).toBe('2026-07-08')
  })

  it('SumsWorkedTargetAndBreakPerDay', () => {
    const r = buildWorktimeReport(base({ shifts: [shift(6, 9, 30)] }))
    const mon = r.days[0]!
    expect(mon.workedMs).toBe(9 * HOUR_MS - 30 * MINUTE_MS)
    expect(mon.breakMs).toBe(30 * MINUTE_MS)
    expect(mon.targetMs).toBe(8 * HOUR_MS)
    expect(r.totalWorkedMs).toBe(9 * HOUR_MS - 30 * MINUTE_MS)
    expect(r.totalTargetMs).toBe(3 * 8 * HOUR_MS)
  })

  it('FlagsBreakViolations', () => {
    // 8h worked with a 10m break → 20m short → a violation day.
    const r = buildWorktimeReport(base({ shifts: [shift(6, 8, 10)] }))
    expect(r.days[0]!.breakShortfallMs).toBe(20 * MINUTE_MS)
    expect(r.breakViolationDays).toBe(1)
  })

  it('CreditsAbsenceDaysAgainstTheTarget', () => {
    // Mon vacation (full day) → its 8h target is credited, so no under-time for it.
    const vac: Absence = {
      kind: 'vacation',
      startDate: '2026-07-06',
      endDate: '2026-07-06',
      halfDay: false,
    }
    const r = buildWorktimeReport(base({ absences: [vac] }))
    expect(r.days[0]!.absence).toBe('vacation')
    expect(r.days[0]!.creditedMs).toBe(8 * HOUR_MS)
    expect(r.absenceDaysByKind.vacation).toBe(1)
    // No work all 3 days, but Monday is credited → overtime = 0 + 8h − 24h = −16h.
    expect(r.overtimeMs).toBe(8 * HOUR_MS - 24 * HOUR_MS)
  })

  it('CreditsHalfForASingleHalfDayAbsence', () => {
    const half: Absence = {
      kind: 'sick',
      startDate: '2026-07-07',
      endDate: '2026-07-07',
      halfDay: true,
    }
    const r = buildWorktimeReport(base({ absences: [half] }))
    expect(r.days[1]!.creditedMs).toBe(4 * HOUR_MS)
    expect(r.absenceDaysByKind.sick).toBe(0.5)
  })

  it('OvertimeIsWorkedPlusCreditedMinusTarget', () => {
    // Mon 8h worked, Tue holiday (8h credited), Wed nothing → 8 + 8 − 24 = −8h.
    const r = buildWorktimeReport(
      base({
        shifts: [shift(6, 8, 0)],
        absences: [
          { kind: 'holiday', startDate: '2026-07-07', endDate: '2026-07-07', halfDay: false },
        ],
      }),
    )
    expect(r.overtimeMs).toBe(8 * HOUR_MS + 8 * HOUR_MS - 24 * HOUR_MS)
  })
})
