import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm'
import { isValidEntry, type TimeEntry as CoreEntry } from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { timeEntries } from '../../db/schema.js'
import { NotFoundError, ValidationError } from '../../errors.js'

/**
 * Workspace-scoped time-entry service (REQ-004). Records tracked time both live
 * (a running timer) and after the fact (manual), always workspace-scoped by
 * construction and always carrying `source` provenance (ADR-0005).
 *
 * A running timer is just a row with `ended_at IS NULL` and a persisted
 * `started_at`; the elapsed clock is derived from that instant, never ticked
 * state, so it survives app kill and device reboot. At most one timer runs per
 * workspace — enforced at the DB level by a partial unique index and preserved
 * here by stopping the previous timer inside the same transaction before a new
 * one starts.
 *
 * Every mutation validates against the deterministic tracking core
 * (`@mydevtime/domain`): the service maps rows to the core's absolute-instant
 * model and rejects anything the core deems invalid, so the API can never
 * persist an entry the timesheet math would choke on.
 *
 * Deletes are **soft** (REQ-006, ADR-0019): `deleted_at` is stamped so the row
 * survives as a tombstone for sync, and every read filters `deleted_at IS NULL`.
 */

export type Entry = typeof timeEntries.$inferSelect

/** Scope to a workspace's live (non-tombstoned) rows. */
function live(workspaceId: string) {
  return and(eq(timeEntries.workspaceId, workspaceId), isNull(timeEntries.deletedAt))
}

function one(rows: readonly Entry[]): Entry {
  const row = rows[0]
  if (!row) throw new NotFoundError('time entry not found')
  return row
}

function assertValid(candidate: CoreEntry): void {
  if (!isValidEntry(candidate)) throw new ValidationError('entry end precedes its start')
}

export interface StartTimerInput {
  projectId?: string | null | undefined
  taskId?: string | null | undefined
  billable?: boolean | undefined
  note?: string | null | undefined
  startedAt?: Date | undefined
}

/**
 * Start a timer, stopping any timer already running in the workspace first (one
 * running timer per workspace). Both writes happen in one transaction so the
 * partial unique index never sees two open rows, even under a concurrent start.
 */
export async function startTimer(
  db: Db,
  workspaceId: string,
  userId: string,
  input: StartTimerInput = {},
): Promise<Entry> {
  const startedAt = input.startedAt ?? new Date()
  return db.transaction(async tx => {
    await tx
      .update(timeEntries)
      .set({ endedAt: startedAt, updatedAt: new Date() })
      .where(and(live(workspaceId), isNull(timeEntries.endedAt)))
    const rows = await tx
      .insert(timeEntries)
      .values({
        workspaceId,
        userId,
        projectId: input.projectId ?? null,
        taskId: input.taskId ?? null,
        startedAt,
        endedAt: null,
        billable: input.billable ?? true,
        source: 'timer',
        note: input.note ?? null,
      })
      .returning()
    return one(rows)
  })
}

/** The workspace's currently running timer, or `null` if none is running. */
export async function getRunning(db: Db, workspaceId: string): Promise<Entry | null> {
  const rows = await db
    .select()
    .from(timeEntries)
    .where(and(live(workspaceId), isNull(timeEntries.endedAt)))
    .limit(1)
  return rows[0] ?? null
}

/** Stop the workspace's running timer at `endedAt` (default now). */
export async function stopTimer(
  db: Db,
  workspaceId: string,
  endedAt: Date = new Date(),
): Promise<Entry> {
  // Load the running row first so we can validate the client-supplied endedAt
  // against the persisted startedAt (deterministic core) — a stop at or before
  // the start would otherwise persist a negative-duration entry the timesheet
  // math rejects (mirrors createManualEntry/updateEntry/clockOut).
  const running = await db
    .select()
    .from(timeEntries)
    .where(and(live(workspaceId), isNull(timeEntries.endedAt)))
    .limit(1)
  const row = running[0]
  if (!row) throw new NotFoundError('no running timer')
  assertValid({
    id: row.id,
    start: row.startedAt.getTime(),
    end: endedAt.getTime(),
    billable: row.billable,
    source: row.source,
  })
  const rows = await db
    .update(timeEntries)
    .set({ endedAt, updatedAt: new Date() })
    .where(and(live(workspaceId), eq(timeEntries.id, row.id), isNull(timeEntries.endedAt)))
    .returning()
  return one(rows)
}

export interface ManualEntryInput {
  startedAt: Date
  endedAt: Date
  projectId?: string | null | undefined
  taskId?: string | null | undefined
  billable?: boolean | undefined
  note?: string | null | undefined
}

/** Create a completed entry after the fact, validated by the tracking core. */
export async function createManualEntry(
  db: Db,
  workspaceId: string,
  userId: string,
  input: ManualEntryInput,
): Promise<Entry> {
  assertValid({
    id: 'new',
    start: input.startedAt.getTime(),
    end: input.endedAt.getTime(),
    billable: input.billable ?? true,
    source: 'manual',
  })
  const rows = await db
    .insert(timeEntries)
    .values({
      workspaceId,
      userId,
      projectId: input.projectId ?? null,
      taskId: input.taskId ?? null,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      billable: input.billable ?? true,
      source: 'manual',
      note: input.note ?? null,
    })
    .returning()
  return one(rows)
}

export interface ListEntriesFilter {
  /** Inclusive lower bound on `startedAt`. */
  from?: Date | undefined
  /** Exclusive upper bound on `startedAt`. */
  to?: Date | undefined
}

/** List a workspace's entries, newest first, optionally within a time window. */
export function listEntries(
  db: Db,
  workspaceId: string,
  filter: ListEntriesFilter = {},
): Promise<Entry[]> {
  const bounds = [eq(timeEntries.workspaceId, workspaceId), isNull(timeEntries.deletedAt)]
  if (filter.from) bounds.push(gte(timeEntries.startedAt, filter.from))
  if (filter.to) bounds.push(lt(timeEntries.startedAt, filter.to))
  return db
    .select()
    .from(timeEntries)
    .where(and(...bounds))
    .orderBy(desc(timeEntries.startedAt))
}

export async function getEntry(db: Db, workspaceId: string, id: string): Promise<Entry> {
  const rows = await db
    .select()
    .from(timeEntries)
    .where(and(live(workspaceId), eq(timeEntries.id, id)))
  return one(rows)
}

export interface EntryPatch {
  startedAt?: Date | undefined
  endedAt?: Date | null | undefined
  projectId?: string | null | undefined
  taskId?: string | null | undefined
  billable?: boolean | undefined
  note?: string | null | undefined
}

/** Edit an entry; any change to its interval is re-validated by the core. */
export async function updateEntry(
  db: Db,
  workspaceId: string,
  id: string,
  patch: EntryPatch,
): Promise<Entry> {
  const current = await getEntry(db, workspaceId, id)
  const nextStart = patch.startedAt ?? current.startedAt
  const nextEnd = patch.endedAt === undefined ? current.endedAt : patch.endedAt
  assertValid({
    id: current.id,
    start: nextStart.getTime(),
    end: nextEnd === null ? null : nextEnd.getTime(),
    billable: patch.billable ?? current.billable,
    source: current.source,
  })

  const values: Partial<typeof timeEntries.$inferInsert> = { updatedAt: new Date() }
  if (patch.startedAt !== undefined) values.startedAt = patch.startedAt
  if (patch.endedAt !== undefined) values.endedAt = patch.endedAt
  if (patch.projectId !== undefined) values.projectId = patch.projectId
  if (patch.taskId !== undefined) values.taskId = patch.taskId
  if (patch.billable !== undefined) values.billable = patch.billable
  if (patch.note !== undefined) values.note = patch.note
  const rows = await db
    .update(timeEntries)
    .set(values)
    .where(and(live(workspaceId), eq(timeEntries.id, id)))
    .returning()
  return one(rows)
}

/**
 * Split a completed entry at instant `at` into two adjacent entries. `at` must
 * lie strictly inside `(start, end)`. The original is shortened to end at `at`
 * and a second entry inherits its attributes from `at` to the original end —
 * both in one transaction. Returns `[first, second]`.
 */
export async function splitEntry(
  db: Db,
  workspaceId: string,
  id: string,
  at: Date,
): Promise<[Entry, Entry]> {
  return db.transaction(async tx => {
    const rows = await tx
      .select()
      .from(timeEntries)
      .where(and(live(workspaceId), eq(timeEntries.id, id)))
    const entry = one(rows)
    if (entry.endedAt === null) throw new ValidationError('cannot split a running timer')
    const atMs = at.getTime()
    if (atMs <= entry.startedAt.getTime() || atMs >= entry.endedAt.getTime()) {
      throw new ValidationError('split point must lie strictly inside the entry')
    }
    const firstRows = await tx
      .update(timeEntries)
      .set({ endedAt: at, updatedAt: new Date() })
      .where(and(live(workspaceId), eq(timeEntries.id, id)))
      .returning()
    const secondRows = await tx
      .insert(timeEntries)
      .values({
        workspaceId,
        userId: entry.userId,
        projectId: entry.projectId,
        taskId: entry.taskId,
        startedAt: at,
        endedAt: entry.endedAt,
        billable: entry.billable,
        source: entry.source,
        note: entry.note,
      })
      .returning()
    return [one(firstRows), one(secondRows)]
  })
}

export async function deleteEntry(db: Db, workspaceId: string, id: string): Promise<void> {
  const rows = await db
    .update(timeEntries)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(live(workspaceId), eq(timeEntries.id, id)))
    .returning({ id: timeEntries.id })
  if (rows.length === 0) throw new NotFoundError('time entry not found')
}
