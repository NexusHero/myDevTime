import {
  dayKey,
  startOfLocalDay,
  startOfNextLocalDay,
  type DurationMs,
  type Instant,
  type TimeZone,
} from '../tracking/time.js'
import {
  isValidShift,
  shiftNetMs,
  targetForDay,
  type Shift,
  type WeeklyTarget,
} from './worktime.js'
import { breakShortfallMs, type BreakRulePreset } from './break-rule.js'
import { coversDate, type Absence, type AbsenceKind } from '../absences/absence.js'

/**
 * The monthly work-time report (REQ-030, ADR-0010) — the deterministic model the
 * signable Arbeitszeitnachweis (PDF/XLSX) renders from. One row per local day with
 * worked / break / target / absence, the period totals, and the overtime balance
 * with **absence days credited against the target** (the REQ-029 interplay: a
 * vacation/sick/holiday day is not owed back). Pure and LLM-free (ADR-0005).
 */

export interface WorktimeReportDay {
  readonly date: string
  readonly workedMs: DurationMs
  readonly breakMs: DurationMs
  readonly breakShortfallMs: DurationMs
  readonly targetMs: DurationMs
  /** Target credited by an absence covering the day (full, or half for a half-day). */
  readonly creditedMs: DurationMs
  readonly absence: AbsenceKind | null
}

export interface WorktimeReport {
  readonly from: string
  readonly to: string
  readonly days: readonly WorktimeReportDay[]
  readonly totalWorkedMs: DurationMs
  readonly totalTargetMs: DurationMs
  readonly totalCreditedMs: DurationMs
  readonly totalBreakMs: DurationMs
  /** `worked + credited − target`; negative means under target. */
  readonly overtimeMs: number
  readonly breakViolationDays: number
  readonly absenceDaysByKind: Record<AbsenceKind, number>
}

export interface WorktimeReportInput {
  /** Local window start (inclusive) and end (exclusive). */
  readonly from: Instant
  readonly to: Instant
  readonly tz: TimeZone
  readonly shifts: readonly Shift[]
  readonly target: WeeklyTarget
  readonly absences: readonly Absence[]
  readonly breakPreset: BreakRulePreset
}

/** The absence covering a day (first match), or null. Half-day single-day → half credit. */
function absenceOn(absences: readonly Absence[], date: string): Absence | null {
  return absences.find(a => coversDate(a, date)) ?? null
}

function dayCredit(a: Absence): number {
  return a.halfDay && a.startDate === a.endDate ? 0.5 : 1
}

export function buildWorktimeReport(input: WorktimeReportInput): WorktimeReport {
  const { from, to, tz, shifts, target, absences, breakPreset } = input

  // Bucket valid shifts by their local start day.
  const byDay = new Map<string, Shift[]>()
  for (const s of shifts) {
    if (!isValidShift(s)) continue
    const key = dayKey(s.start, tz)
    const list = byDay.get(key)
    if (list) list.push(s)
    else byDay.set(key, [s])
  }

  const days: WorktimeReportDay[] = []
  const absenceDaysByKind: Record<AbsenceKind, number> = {
    vacation: 0,
    sick: 0,
    holiday: 0,
    other: 0,
  }
  let totalWorkedMs = 0
  let totalTargetMs = 0
  let totalCreditedMs = 0
  let totalBreakMs = 0
  let breakViolationDays = 0

  for (
    let cursor = startOfLocalDay(from, tz);
    cursor < to;
    cursor = startOfNextLocalDay(cursor, tz)
  ) {
    const date = dayKey(cursor, tz)
    const targetMs = targetForDay(target, cursor, tz)
    const dayShifts = byDay.get(date) ?? []

    let workedMs = 0
    let breakMs = 0
    let shortfallMs = 0
    for (const s of dayShifts) {
      workedMs += shiftNetMs(s)
      breakMs += s.breakMs
      shortfallMs += breakShortfallMs(s, breakPreset)
    }

    const covering = absenceOn(absences, date)
    const creditedMs = covering ? Math.round(targetMs * dayCredit(covering)) : 0
    if (covering) absenceDaysByKind[covering.kind] += dayCredit(covering)
    if (shortfallMs > 0) breakViolationDays += 1

    days.push({
      date,
      workedMs,
      breakMs,
      breakShortfallMs: shortfallMs,
      targetMs,
      creditedMs,
      absence: covering ? covering.kind : null,
    })
    totalWorkedMs += workedMs
    totalTargetMs += targetMs
    totalCreditedMs += creditedMs
    totalBreakMs += breakMs
  }

  const last = days[days.length - 1]
  return {
    from: days[0]?.date ?? dayKey(startOfLocalDay(from, tz), tz),
    to: last?.date ?? dayKey(startOfLocalDay(from, tz), tz),
    days,
    totalWorkedMs,
    totalTargetMs,
    totalCreditedMs,
    totalBreakMs,
    overtimeMs: totalWorkedMs + totalCreditedMs - totalTargetMs,
    breakViolationDays,
    absenceDaysByKind,
  }
}
