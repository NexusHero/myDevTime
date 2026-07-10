import { and, desc, eq, gte, isNotNull, lt, lte } from 'drizzle-orm'
import {
  computeOvertime,
  type OvertimeBalance,
  type Shift as CoreShift,
  type WeeklyTarget,
} from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { attendanceShifts, workSchedules } from '../../db/schema.js'

/**
 * Attendance persistence (REQ-028, ADR-0010): shifts (clock-in/out with breaks)
 * and effective-dated target-hour schedules, workspace-scoped by construction.
 * The service stays thin — it stores rows and hands them to the deterministic
 * `computeOvertime` core; no work-time arithmetic happens here (ADR-0005).
 */

export type ShiftRow = typeof attendanceShifts.$inferSelect
export type ScheduleRow = typeof workSchedules.$inferSelect

const ZERO_TARGET: WeeklyTarget = [0, 0, 0, 0, 0, 0, 0]

function first<T>(rows: readonly T[]): T {
  const row = rows[0]
  if (!row) throw new Error('insert returned no row')
  return row
}

/** Coerce a stored `weekly_target_ms` array into the core's fixed 7-tuple. */
function toWeeklyTarget(arr: readonly number[]): WeeklyTarget {
  const v = (i: number): number => arr[i] ?? 0
  return [v(0), v(1), v(2), v(3), v(4), v(5), v(6)]
}

export interface CreateShiftInput {
  startedAt: Date
  endedAt: Date
  breakMs?: number | undefined
  source?: string | undefined
}

/** Record a completed shift (a punch pair) for the caller's workspace. */
export async function createShift(
  db: Db,
  workspaceId: string,
  userId: string,
  input: CreateShiftInput,
): Promise<ShiftRow> {
  const rows = await db
    .insert(attendanceShifts)
    .values({
      workspaceId,
      userId,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      breakMs: input.breakMs ?? 0,
      source: input.source ?? 'manual',
    })
    .returning()
  return first(rows)
}

export interface SetScheduleInput {
  effectiveFrom: Date
  /** Target ms per ISO weekday, Monday first — `[Mon…Sun]`, length 7. */
  weeklyTargetMs: number[]
}

/** Append an effective-dated weekly target schedule (history is never edited). */
export async function setSchedule(
  db: Db,
  workspaceId: string,
  input: SetScheduleInput,
): Promise<ScheduleRow> {
  const rows = await db
    .insert(workSchedules)
    .values({
      workspaceId,
      effectiveFrom: input.effectiveFrom,
      weeklyTargetMs: input.weeklyTargetMs,
    })
    .returning()
  return first(rows)
}

/** The weekly target in effect at `asOf` (latest effective_from ≤ asOf), or all-zero. */
export async function activeTarget(db: Db, workspaceId: string, asOf: Date): Promise<WeeklyTarget> {
  const rows = await db
    .select()
    .from(workSchedules)
    .where(and(eq(workSchedules.workspaceId, workspaceId), lte(workSchedules.effectiveFrom, asOf)))
    .orderBy(desc(workSchedules.effectiveFrom))
    .limit(1)
  const row = rows[0]
  return row ? toWeeklyTarget(row.weeklyTargetMs) : ZERO_TARGET
}

export interface WorktimeQuery {
  from: Date
  to: Date
  tz: string
  asOf?: Date | undefined
}

/**
 * The overtime balance for a window: net worked time of completed shifts starting
 * inside it, minus the target of the schedule in effect at the window, computed by
 * the deterministic core.
 */
export async function worktimeSummary(
  db: Db,
  workspaceId: string,
  query: WorktimeQuery,
): Promise<OvertimeBalance> {
  const rows = await db
    .select()
    .from(attendanceShifts)
    .where(
      and(
        eq(attendanceShifts.workspaceId, workspaceId),
        gte(attendanceShifts.startedAt, query.from),
        lt(attendanceShifts.startedAt, query.to),
        isNotNull(attendanceShifts.endedAt),
      ),
    )
  const shifts: CoreShift[] = rows
    .filter((r): r is ShiftRow & { endedAt: Date } => r.endedAt !== null)
    .map(r => ({ start: r.startedAt.getTime(), end: r.endedAt.getTime(), breakMs: r.breakMs }))
  const target = await activeTarget(db, workspaceId, query.asOf ?? query.to)
  return computeOvertime(shifts, target, {
    from: query.from.getTime(),
    to: query.to.getTime(),
    tz: query.tz,
  })
}
