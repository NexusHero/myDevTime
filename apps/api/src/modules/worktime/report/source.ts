import { and, eq, gte, isNotNull, lt } from 'drizzle-orm'
import {
  ARBZG_PRESET,
  buildWorktimeReport,
  zonedTimeToInstant,
  type Absence,
  type AbsenceKind,
  type Shift,
  type WorktimeReport,
} from '@mydevtime/domain'
import type { Db } from '../../../db/client.js'
import { absences, attendanceShifts, workspaces } from '../../../db/schema.js'
import { activeTarget } from '../service.js'

/**
 * Loads a month's attendance and absences and builds the deterministic
 * `WorktimeReport` (REQ-030). The DB access lives here; every number in the report
 * is the domain core's (ADR-0005). The signable PDF/XLSX serializers render this
 * model — they never compute.
 */
export interface ReportMeta {
  readonly workspaceName: string
  readonly tz: string
  readonly monthLabel: string
  readonly from: string
  readonly to: string
}

const pad = (n: number): string => String(n).padStart(2, '0')

export async function loadWorktimeReport(
  db: Db,
  workspaceId: string,
  opts: { year: number; month: number; tz: string },
): Promise<{ report: WorktimeReport; meta: ReportMeta }> {
  const { year, month, tz } = opts
  // Local month bounds → absolute instants (DST-safe via the domain helper).
  const fromInstant = zonedTimeToInstant({ year, month, day: 1, hour: 0, minute: 0, second: 0 }, tz)
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
  const toInstant = zonedTimeToInstant(
    { year: nextMonth.y, month: nextMonth.m, day: 1, hour: 0, minute: 0, second: 0 },
    tz,
  )
  const fromDate = new Date(fromInstant)
  const toDate = new Date(toInstant)
  const firstDay = `${String(year)}-${pad(month)}-01`
  const lastDay = `${String(nextMonth.y)}-${pad(nextMonth.m)}-01` // exclusive upper bound (string)

  const shiftRows = await db
    .select()
    .from(attendanceShifts)
    .where(
      and(
        eq(attendanceShifts.workspaceId, workspaceId),
        gte(attendanceShifts.startedAt, fromDate),
        lt(attendanceShifts.startedAt, toDate),
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

  const target = await activeTarget(db, workspaceId, toDate)
  const report = buildWorktimeReport({
    from: fromInstant,
    to: toInstant,
    tz,
    shifts,
    target,
    absences: leave,
    breakPreset: ARBZG_PRESET,
  })

  const wsRows = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
  const workspaceName = wsRows[0]?.name ?? 'Workspace'
  const meta: ReportMeta = {
    workspaceName,
    tz,
    monthLabel: `${String(year)}-${pad(month)}`,
    from: report.from,
    to: report.to,
  }
  return { report, meta }
}
