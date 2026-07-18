import { and, asc, desc, eq, gt, gte, isNotNull, isNull, lt, lte } from 'drizzle-orm'
import {
  ARBZG_PRESET,
  breakShortfallMs,
  computeOvertime,
  reconcileCoverage,
  type BookedInterval,
  type CoverageReport,
  type OvertimeBalance,
  type Shift as CoreShift,
  type WeeklyTarget,
} from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { attendanceShifts, timeEntries, workSchedules } from '../../db/schema.js'
import { NotFoundError, ValidationError } from '../../errors.js'

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

/** The workspace's currently open shift (clocked in, not out), or `null`. */
export async function getRunningShift(db: Db, workspaceId: string): Promise<ShiftRow | null> {
  const rows = await db
    .select()
    .from(attendanceShifts)
    .where(and(eq(attendanceShifts.workspaceId, workspaceId), isNull(attendanceShifts.endedAt)))
    .limit(1)
  return rows[0] ?? null
}

export interface ClockInInput {
  startedAt?: Date | undefined
  source?: string | undefined
}

/**
 * A Postgres `unique_violation` (SQLSTATE 23505) surfacing through the driver. Drizzle wraps the
 * pg error in a `DrizzleQueryError` and hangs the original on `.cause`, so the code is nested, not
 * top-level — walk the cause chain (bounded) so the concurrent-clock-in loser is always mapped to
 * a clean `ValidationError`, never a raw 500 (audit M9). Missing this nesting was a race-only flake.
 */
export function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e != null && depth < 5; depth += 1) {
    if (typeof e === 'object' && (e as { code?: unknown }).code === '23505') return true
    e = (e as { cause?: unknown }).cause
  }
  return false
}

/**
 * Clock in: open a shift. At most one open shift per workspace (enforced by the
 * partial unique index `attendance_shifts_one_open_per_ws`). The read-then-insert
 * rejects a sequential second clock-in with a clear error; a **concurrent** second
 * clock-in (both pass the read, both insert) is caught from the index violation and
 * mapped to the same `ValidationError` — so the loser gets a 400, never a raw 500
 * (audit M9). Data integrity holds either way: exactly one open shift persists.
 */
export async function clockIn(
  db: Db,
  workspaceId: string,
  userId: string,
  input: ClockInInput = {},
): Promise<ShiftRow> {
  if (await getRunningShift(db, workspaceId)) {
    throw new ValidationError('already clocked in')
  }
  try {
    const rows = await db
      .insert(attendanceShifts)
      .values({
        workspaceId,
        userId,
        startedAt: input.startedAt ?? new Date(),
        endedAt: null,
        breakMs: 0,
        source: input.source ?? 'clock',
      })
      .returning()
    return first(rows)
  } catch (err) {
    if (isUniqueViolation(err)) throw new ValidationError('already clocked in')
    throw err
  }
}

export interface ClockOutInput {
  endedAt?: Date | undefined
  breakMs?: number | undefined
}

/** Clock out: close the open shift at `endedAt` (default now), recording breaks. */
export async function clockOut(
  db: Db,
  workspaceId: string,
  input: ClockOutInput = {},
): Promise<ShiftRow> {
  const running = await getRunningShift(db, workspaceId)
  if (!running) throw new NotFoundError('no open shift')
  const endedAt = input.endedAt ?? new Date()
  if (endedAt.getTime() <= running.startedAt.getTime()) {
    throw new ValidationError('clock-out precedes clock-in')
  }
  const rows = await db
    .update(attendanceShifts)
    .set({ endedAt, breakMs: input.breakMs ?? running.breakMs, updatedAt: new Date() })
    .where(eq(attendanceShifts.id, running.id))
    .returning()
  return first(rows)
}

export interface ShiftView {
  id: string
  startedAt: Date
  endedAt: Date | null
  breakMs: number
  source: string
  /** Minutes the break falls short of the ArbZG §4 rule (0 while open/compliant). */
  breakShortfallMs: number
}

/** List the workspace's shifts whose start falls in `[from, to)`, newest first. */
export async function listShifts(
  db: Db,
  workspaceId: string,
  range: { from: Date; to: Date },
): Promise<ShiftView[]> {
  const rows = await db
    .select()
    .from(attendanceShifts)
    .where(
      and(
        eq(attendanceShifts.workspaceId, workspaceId),
        gte(attendanceShifts.startedAt, range.from),
        lt(attendanceShifts.startedAt, range.to),
      ),
    )
    .orderBy(desc(attendanceShifts.startedAt), asc(attendanceShifts.id))
  return rows.map(r => ({
    id: r.id,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    breakMs: r.breakMs,
    source: r.source,
    breakShortfallMs:
      r.endedAt === null
        ? 0
        : breakShortfallMs(
            { start: r.startedAt.getTime(), end: r.endedAt.getTime(), breakMs: r.breakMs },
            ARBZG_PRESET,
          ),
  }))
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

/**
 * Project-coverage reconciliation for a window (REQ-028 follow-up, #149): how much
 * of the completed shifts' on-the-clock time is booked to a project. Loads the
 * completed shifts starting in the window and the completed, non-deleted project
 * entries overlapping it, then hands both to the deterministic `reconcileCoverage`
 * core — no arithmetic here (ADR-0005). Workspace-scoped by construction.
 */
export async function worktimeCoverage(
  db: Db,
  workspaceId: string,
  range: { from: Date; to: Date },
): Promise<CoverageReport> {
  const shiftRows = await db
    .select()
    .from(attendanceShifts)
    .where(
      and(
        eq(attendanceShifts.workspaceId, workspaceId),
        gte(attendanceShifts.startedAt, range.from),
        lt(attendanceShifts.startedAt, range.to),
        isNotNull(attendanceShifts.endedAt),
      ),
    )
  const shifts: CoreShift[] = shiftRows
    .filter((r): r is ShiftRow & { endedAt: Date } => r.endedAt !== null)
    .map(r => ({ start: r.startedAt.getTime(), end: r.endedAt.getTime(), breakMs: r.breakMs }))

  // Completed, non-deleted project entries overlapping [from, to).
  const entryRows = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, workspaceId),
        isNotNull(timeEntries.projectId),
        isNotNull(timeEntries.endedAt),
        isNull(timeEntries.deletedAt),
        lt(timeEntries.startedAt, range.to),
        gt(timeEntries.endedAt, range.from),
      ),
    )
  const bookings: BookedInterval[] = entryRows
    .filter((r): r is (typeof entryRows)[number] & { endedAt: Date } => r.endedAt !== null)
    .map(r => ({ start: r.startedAt.getTime(), end: r.endedAt.getTime() }))

  return reconcileCoverage(shifts, bookings)
}
