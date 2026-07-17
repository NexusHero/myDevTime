import { and, eq, gte, isNotNull, lt } from 'drizzle-orm'
import {
  buildMonthlyStatement,
  zonedTimeToInstant,
  type Absence,
  type AbsenceKind,
  type MonthlyStatement,
  type Shift,
} from '@mydevtime/domain'
import type { Db } from '../../../db/client.js'
import { absences, attendanceShifts, workspaces } from '../../../db/schema.js'
import { activeTarget } from '../service.js'
import type { ReportMeta } from './source.js'

/**
 * Loads a month of real punch events and builds the deterministic `MonthlyStatement`
 * (REQ-052, design v13 X). The **carryover** is honest year-to-date: prior months of the
 * same calendar year are folded (crediting absences exactly as the statement does) so the
 * opening balance is the real running figure, not a guess. DB access lives here; every
 * minute in the statement is the domain core's (ADR-0005). The PDF serializer renders
 * this model — it never computes.
 */
const pad = (n: number): string => String(n).padStart(2, '0')

function monthShiftsAndAbsences(
  allShifts: readonly Shift[],
  allAbsences: readonly Absence[],
): { shifts: readonly Shift[]; absences: readonly Absence[] } {
  // The domain builder already windows shifts to the month by start instant and matches
  // absences by date-string overlap, so we can hand it the full-year sets unfiltered.
  return { shifts: allShifts, absences: allAbsences }
}

export async function loadMonthlyStatement(
  db: Db,
  workspaceId: string,
  opts: { year: number; month: number; tz: string },
): Promise<{ statement: MonthlyStatement; meta: ReportMeta }> {
  const { year, month, tz } = opts

  // Load the whole calendar year up to (and including) the requested month, once.
  const yearStart = zonedTimeToInstant(
    { year, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
    tz,
  )
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
  const monthEnd = zonedTimeToInstant(
    { year: next.y, month: next.m, day: 1, hour: 0, minute: 0, second: 0 },
    tz,
  )
  const yearStartDate = new Date(yearStart)
  const monthEndDate = new Date(monthEnd)
  const firstDay = `${String(year)}-01-01`
  const lastDay = `${String(next.y)}-${pad(next.m)}-01` // exclusive (string)

  const shiftRows = await db
    .select()
    .from(attendanceShifts)
    .where(
      and(
        eq(attendanceShifts.workspaceId, workspaceId),
        gte(attendanceShifts.startedAt, yearStartDate),
        lt(attendanceShifts.startedAt, monthEndDate),
        isNotNull(attendanceShifts.endedAt),
      ),
    )
  const shifts: Shift[] = shiftRows
    .filter((r): r is typeof r & { endedAt: Date } => r.endedAt !== null)
    .map(r => ({ start: r.startedAt.getTime(), end: r.endedAt.getTime(), breakMs: r.breakMs }))

  const absenceRows = await db
    .select()
    .from(absences)
    .where(
      and(
        eq(absences.workspaceId, workspaceId),
        lt(absences.startDate, lastDay),
        gte(absences.endDate, firstDay),
      ),
    )
  const leave: Absence[] = absenceRows.map(r => ({
    kind: r.kind as AbsenceKind,
    startDate: r.startDate,
    endDate: r.endDate,
    halfDay: r.halfDay,
  }))

  const target = await activeTarget(db, workspaceId, monthEndDate)
  const { shifts: allShifts, absences: allAbsences } = monthShiftsAndAbsences(shifts, leave)

  // Fold prior months of the year to get the honest year-to-date carryover.
  let carryoverMs = 0
  for (let m = 1; m < month; m++) {
    const prior = buildMonthlyStatement({
      year,
      month: m,
      tz,
      shifts: allShifts,
      target,
      absences: allAbsences,
      breakPreset: [],
      carryoverMs,
    })
    carryoverMs = prior.closingBalanceMs
  }

  const statement = buildMonthlyStatement({
    year,
    month,
    tz,
    shifts: allShifts,
    target,
    absences: allAbsences,
    breakPreset: [],
    carryoverMs,
  })

  const wsRows = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
  const workspaceName = wsRows[0]?.name ?? 'Workspace'
  const meta: ReportMeta = {
    workspaceName,
    tz,
    monthLabel: `${String(year)}-${pad(month)}`,
    from: statement.from,
    to: statement.to,
  }
  return { statement, meta }
}
