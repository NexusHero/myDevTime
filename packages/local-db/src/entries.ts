import { fromBool, toBool, type LocalDb, type Row } from './port.js'
import { newId, nowIso } from './ids.js'

/**
 * Time-entry repository (REQ-004). Thin CRUD over the `time_entries` rows —
 * **no aggregation, no money/time math** (that is `packages/domain`'s job,
 * ADR-0005). Every method takes a `workspaceId` non-optionally (isolation by
 * construction); a running timer is a row with `ended_at IS NULL`.
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

function toEntry(row: Row): LocalTimeEntry {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    projectId: row.project_id === null ? null : String(row.project_id),
    taskId: row.task_id === null ? null : String(row.task_id),
    startedAt: String(row.started_at),
    endedAt: row.ended_at === null ? null : String(row.ended_at),
    billable: toBool(row.billable ?? 1),
    source: String(row.source),
    note: row.note === null ? null : String(row.note ?? null),
  }
}

const SELECT = `
  id, workspace_id, project_id, task_id, started_at, ended_at, billable, source, note
  FROM time_entries WHERE workspace_id = ? AND deleted_at IS NULL`

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
  const row = await db.getFirstAsync(
    `SELECT ${SELECT} AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
    [workspaceId],
  )
  return row ? toEntry(row) : null
}

/** All entries in the workspace, newest first (bounded by `limit`). */
export async function listEntries(
  db: LocalDb,
  workspaceId: string,
  limit = 200,
): Promise<LocalTimeEntry[]> {
  const rows = await db.getAllAsync(`SELECT ${SELECT} ORDER BY started_at DESC LIMIT ?`, [
    workspaceId,
    limit,
  ])
  return rows.map(toEntry)
}

/** Entries whose start falls in `[from, to)` (ISO bounds), newest first. */
export async function listEntriesInRange(
  db: LocalDb,
  workspaceId: string,
  from: string,
  to: string,
): Promise<LocalTimeEntry[]> {
  const rows = await db.getAllAsync(
    `SELECT ${SELECT} AND started_at >= ? AND started_at < ? ORDER BY started_at DESC`,
    [workspaceId, from, to],
  )
  return rows.map(toEntry)
}

/** Start a timer: stop any running one first, then insert a fresh running row. */
export async function startEntry(
  db: LocalDb,
  workspaceId: string,
  input: StartEntryInput = {},
): Promise<LocalTimeEntry> {
  const now = nowIso()
  await db.runAsync(
    `UPDATE time_entries SET ended_at = ?, updated_at = ?
       WHERE workspace_id = ? AND ended_at IS NULL AND deleted_at IS NULL`,
    [now, now, workspaceId],
  )
  const id = input.id ?? newId()
  const billable = input.billable ?? true
  await db.runAsync(
    `INSERT INTO time_entries
       (id, workspace_id, project_id, task_id, started_at, billable, source, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      workspaceId,
      input.projectId ?? null,
      input.taskId ?? null,
      now,
      fromBool(billable),
      input.source ?? 'timer',
      input.note ?? null,
      now,
      now,
    ],
  )
  return {
    id,
    workspaceId,
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    startedAt: now,
    endedAt: null,
    billable,
    source: input.source ?? 'timer',
    note: input.note ?? null,
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
  await db.runAsync(`UPDATE time_entries SET ended_at = ?, updated_at = ? WHERE id = ?`, [
    now,
    now,
    running.id,
  ])
  return { ...running, endedAt: now }
}

/** Soft-delete an entry (tombstone so the deletion can later sync, ADR-0019). */
export async function deleteEntry(db: LocalDb, workspaceId: string, id: string): Promise<void> {
  const now = nowIso()
  await db.runAsync(
    `UPDATE time_entries SET deleted_at = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`,
    [now, now, id, workspaceId],
  )
}
