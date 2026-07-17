import {
  dayKey,
  startOfLocalDay,
  startOfNextLocalDay,
  zonedTimeToInstant,
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
 * Monthly work-time statement (REQ-052, ADR-0065 · design v13 X) — the "real punch
 * clock" the signable monthly timesheet PDF renders one month per A4 page from. Where
 * the REQ-030 report gives worked/target/overtime, this adds the columns an auditor and
 * a works council actually want: the day's **begin** (first clock-in) and **end** (last
 * clock-out), the **pause** taken, the day **±** against target, and a **cumulative
 * balance** that runs from a **carryover** opening figure through the month to a closing
 * one. Absence days appear as their own rows, credited but unpunched. Pure and LLM-free
 * (ADR-0005): every minute comes from real punch events, never a proposal.
 */

export interface StatementDay {
  readonly date: string
  /** Earliest clock-in of the day (ms), or null when the day has no shift. */
  readonly beginMs: Instant | null
  /** Latest clock-out of the day (ms), or null when the day has no shift. */
  readonly endMs: Instant | null
  /** Total break/pause time taken across the day's shifts. */
  readonly pauseMs: DurationMs
  /** Net worked time (actual), gross span minus pauses. */
  readonly actualMs: DurationMs
  readonly targetMs: DurationMs
  /** Target credited by an absence covering the day (full, or half for a half-day). */
  readonly creditedMs: DurationMs
  /** `actual + credited − target`; negative means under target for the day. */
  readonly deltaMs: number
  /** Running balance: carryover + Σ delta up to and including this day. */
  readonly cumulativeMs: number
  /** True when the day's break fell short of the statutory rule (ArbZG §4). */
  readonly breakViolation: boolean
  readonly absence: AbsenceKind | null
}

export interface MonthlyStatement {
  readonly year: number
  /** Calendar month, 1..12. */
  readonly month: number
  readonly from: string
  readonly to: string
  readonly days: readonly StatementDay[]
  /** Opening balance carried in from the prior period. */
  readonly carryoverMs: number
  readonly totalActualMs: DurationMs
  readonly totalTargetMs: DurationMs
  readonly totalCreditedMs: DurationMs
  readonly totalPauseMs: DurationMs
  /** Sum of daily deltas for the month (excludes carryover). */
  readonly periodDeltaMs: number
  /** carryover + periodDelta — the figure that carries into next month. */
  readonly closingBalanceMs: number
  /** Days that carry at least one valid shift. */
  readonly workedDays: number
  readonly absenceDaysByKind: Record<AbsenceKind, number>
  readonly breakViolationDays: number
  /** A short, deterministic audit line for the PDF footer. */
  readonly auditNote: string
}

export interface MonthlyStatementInput {
  readonly year: number
  /** Calendar month, 1..12. */
  readonly month: number
  readonly tz: TimeZone
  readonly shifts: readonly Shift[]
  readonly target: WeeklyTarget
  readonly absences: readonly Absence[]
  readonly breakPreset: BreakRulePreset
  /** Opening balance carried in from the prior month (default 0). */
  readonly carryoverMs?: number
}

function absenceOn(absences: readonly Absence[], date: string): Absence | null {
  return absences.find(a => coversDate(a, date)) ?? null
}

function dayCredit(a: Absence): number {
  return a.halfDay && a.startDate === a.endDate ? 0.5 : 1
}

function monthStart(year: number, month: number, tz: TimeZone): Instant {
  return zonedTimeToInstant({ year, month, day: 1, hour: 0, minute: 0, second: 0 }, tz)
}

/**
 * Build the monthly statement for `year`/`month` from real punch events. Days run over
 * the whole calendar month in the given timezone; a running balance threads the
 * carryover through every day to a closing figure. Invalid shifts are skipped so one
 * bad punch pair never corrupts the statement.
 */
export function buildMonthlyStatement(input: MonthlyStatementInput): MonthlyStatement {
  const { year, month, tz, shifts, target, absences, breakPreset } = input
  if (month < 1 || month > 12) throw new Error('month must be 1..12')
  const carryoverMs = input.carryoverMs ?? 0

  const from = monthStart(year, month, tz)
  const to = monthStart(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, tz)

  // Bucket valid shifts by their local start day.
  const byDay = new Map<string, Shift[]>()
  for (const s of shifts) {
    if (!isValidShift(s)) continue
    if (s.start < from || s.start >= to) continue
    const key = dayKey(s.start, tz)
    const list = byDay.get(key)
    if (list) list.push(s)
    else byDay.set(key, [s])
  }

  const days: StatementDay[] = []
  const absenceDaysByKind: Record<AbsenceKind, number> = {
    vacation: 0,
    sick: 0,
    holiday: 0,
    other: 0,
  }
  let totalActualMs = 0
  let totalTargetMs = 0
  let totalCreditedMs = 0
  let totalPauseMs = 0
  let workedDays = 0
  let breakViolationDays = 0
  let cumulative = carryoverMs

  for (
    let cursor = startOfLocalDay(from, tz);
    cursor < to;
    cursor = startOfNextLocalDay(cursor, tz)
  ) {
    const date = dayKey(cursor, tz)
    const targetMs = targetForDay(target, cursor, tz)
    const dayShifts = byDay.get(date) ?? []

    let actualMs = 0
    let pauseMs = 0
    let shortfallMs = 0
    let beginMs: Instant | null = null
    let endMs: Instant | null = null
    for (const s of dayShifts) {
      actualMs += shiftNetMs(s)
      pauseMs += s.breakMs
      shortfallMs += breakShortfallMs(s, breakPreset)
      beginMs = beginMs === null ? s.start : Math.min(beginMs, s.start)
      endMs = endMs === null ? s.end : Math.max(endMs, s.end)
    }

    const covering = absenceOn(absences, date)
    const creditedMs = covering ? Math.round(targetMs * dayCredit(covering)) : 0
    if (covering) absenceDaysByKind[covering.kind] += dayCredit(covering)
    const breakViolation = shortfallMs > 0
    if (breakViolation) breakViolationDays += 1
    if (dayShifts.length > 0) workedDays += 1

    const deltaMs = actualMs + creditedMs - targetMs
    cumulative += deltaMs

    days.push({
      date,
      beginMs,
      endMs,
      pauseMs,
      actualMs,
      targetMs,
      creditedMs,
      deltaMs,
      cumulativeMs: cumulative,
      breakViolation,
      absence: covering ? covering.kind : null,
    })

    totalActualMs += actualMs
    totalTargetMs += targetMs
    totalCreditedMs += creditedMs
    totalPauseMs += pauseMs
  }

  const periodDeltaMs = totalActualMs + totalCreditedMs - totalTargetMs
  const closingBalanceMs = carryoverMs + periodDeltaMs
  const auditNote = `Generated from ${String(workedDays)} punched day(s) and ${String(days.length - workedDays)} non-working day(s); figures are computed deterministically from recorded punch events.`

  return {
    year,
    month,
    from: days[0]?.date ?? dayKey(from, tz),
    to: days[days.length - 1]?.date ?? dayKey(from, tz),
    days,
    carryoverMs,
    totalActualMs,
    totalTargetMs,
    totalCreditedMs,
    totalPauseMs,
    periodDeltaMs,
    closingBalanceMs,
    workedDays,
    absenceDaysByKind,
    breakViolationDays,
    auditNote,
  }
}
