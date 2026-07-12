import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm'
import type { LocalDb } from './port.js'
import { drizzleFor } from './db.js'
import { timeEntries } from './tables.js'
import { newId, nowIso } from './ids.js'

/**
 * Time-entry repository (REQ-004). Thin CRUD over the `time_entries` rows —
 * **no aggregation, no money/time math** (that is `packages/domain`'s job,
 * ADR-0005). Every method takes a `workspaceId` non-optionally (isolation by
 * construction); a running timer is a row with `ended_at IS NULL`. Queries go
 * through Drizzle (ADR-0046) — the column projection below is the typed
 * replacement for the old hand-written `SELECT` + row mapper.
 */
export interface LocalTimeEntry {
  readonly id: string
  readonly workspaceId: string
  readonly projectId: string | null
  readonly taskId: string | null
  readonly startedAt: string
  readonly endedAt: string | null
  readonly billable: boolean
  readonly source: string
  readonly note: string | null
}

/** The public projection — the entity columns, minus the sync/tenancy bookkeeping. */
const cols = {
  id: timeEntries.id,
  workspaceId: timeEntries.workspaceId,
  projectId: timeEntries.projectId,
  taskId: timeEntries.taskId,
  startedAt: timeEntries.startedAt,
  endedAt: timeEntries.endedAt,
  billable: timeEntries.billable,
  source: timeEntries.source,
  note: timeEntries.note,
}

export interface StartEntryInput {
  readonly projectId?: string | null
  readonly taskId?: string | null
  readonly note?: string | null
  readonly billable?: boolean
  readonly source?: string
  /** Provide to reuse a client id (sync); otherwise a fresh UUID is generated. */
  readonly id?: string
}

/** The currently running entry (`ended_at IS NULL`) in the workspace, or null. */
export async function getRunningEntry(
  db: LocalDb,
  workspaceId: string,
): Promise<LocalTimeEntry | null> {
  const rows = await drizzleFor(db)
    .select(cols)
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, workspaceId),
        isNull(timeEntries.deletedAt),
        isNull(timeEntries.endedAt),
      ),
    )
    .orderBy(desc(timeEntries.startedAt))
    .limit(1)
  return rows[0] ?? null
}

/** All entries in the workspace, newest first (bounded by `limit`). */
export async function listEntries(
  db: LocalDb,
  workspaceId: string,
  limit = 200,
): Promise<LocalTimeEntry[]> {
  return drizzleFor(db)
    .select(cols)
    .from(timeEntries)
    .where(and(eq(timeEntries.workspaceId, workspaceId), isNull(timeEntries.deletedAt)))
    .orderBy(desc(timeEntries.startedAt))
    .limit(limit)
}

/** Entries whose start falls in `[from, to)` (ISO bounds), newest first. */
export async function listEntriesInRange(
  db: LocalDb,
  workspaceId: string,
  from: string,
  to: string,
): Promise<LocalTimeEntry[]> {
  return drizzleFor(db)
    .select(cols)
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, workspaceId),
        isNull(timeEntries.deletedAt),
        gte(timeEntries.startedAt, from),
        lt(timeEntries.startedAt, to),
      ),
    )
    .orderBy(desc(timeEntries.startedAt))
}

/** Start a timer: stop any running one first, then insert a fresh running row. */
export async function startEntry(
  db: LocalDb,
  workspaceId: string,
  input: StartEntryInput = {},
): Promise<LocalTimeEntry> {
  const d = drizzleFor(db)
  const now = nowIso()
  await d
    .update(timeEntries)
    .set({ endedAt: now, updatedAt: now })
    .where(
      and(
        eq(timeEntries.workspaceId, workspaceId),
        isNull(timeEntries.endedAt),
        isNull(timeEntries.deletedAt),
      ),
    )
  const id = input.id ?? newId()
  const billable = input.billable ?? true
  const source = input.source ?? 'timer'
  const projectId = input.projectId ?? null
  const taskId = input.taskId ?? null
  const note = input.note ?? null
  await d.insert(timeEntries).values({
    id,
    workspaceId,
    projectId,
    taskId,
    startedAt: now,
    billable,
    source,
    note,
    createdAt: now,
    updatedAt: now,
  })
  return {
    id,
    workspaceId,
    projectId,
    taskId,
    startedAt: now,
    endedAt: null,
    billable,
    source,
    note,
  }
}

/** Stop the running timer in the workspace; returns the stopped entry or null. */
export async function stopRunningEntry(
  db: LocalDb,
  workspaceId: string,
): Promise<LocalTimeEntry | null> {
  const running = await getRunningEntry(db, workspaceId)
  if (!running) return null
  const now = nowIso()
  await drizzleFor(db)
    .update(timeEntries)
    .set({ endedAt: now, updatedAt: now })
    .where(eq(timeEntries.id, running.id))
  return { ...running, endedAt: now }
}

/** Soft-delete an entry (tombstone so the deletion can later sync, ADR-0019). */
export async function deleteEntry(db: LocalDb, workspaceId: string, id: string): Promise<void> {
  const now = nowIso()
  await drizzleFor(db)
    .update(timeEntries)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(timeEntries.id, id), eq(timeEntries.workspaceId, workspaceId)))
}
