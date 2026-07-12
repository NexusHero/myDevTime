import type { LocalDb } from './client.js'

/** A locally stored time entry. Matches the shape the hooks already consume. */
export interface LocalTimeEntry {
  readonly id: string
  readonly projectId: string | null
  readonly taskId: string | null
  readonly startedAt: string
  readonly endedAt: string | null
  readonly billable: boolean
  readonly source: string
  readonly note: string | null
}

function uuid(): string {
  // crypto.randomUUID is available in modern RN/Hermes and web
  return (
    (globalThis as any).crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

function rowToEntry(row: Record<string, unknown>): LocalTimeEntry {
  return {
    id: row['id'] as string,
    projectId: (row['project_id'] as string) ?? null,
    taskId: (row['task_id'] as string) ?? null,
    startedAt: row['started_at'] as string,
    endedAt: (row['ended_at'] as string) ?? null,
    billable: (row['billable'] as number) === 1,
    source: row['source'] as string,
    note: (row['note'] as string) ?? null,
  }
}

/** Get the currently running timer (ended_at IS NULL), or null. */
export async function getRunningEntry(db: LocalDb): Promise<LocalTimeEntry | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM time_entries WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
  )
  return row ? rowToEntry(row) : null
}

/** List all entries, newest first. */
export async function listEntries(db: LocalDb, limit = 100): Promise<LocalTimeEntry[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM time_entries ORDER BY started_at DESC LIMIT ?',
    [limit],
  )
  return rows.map(rowToEntry)
}

/** List entries within a date range (ISO strings). */
export async function listEntriesInRange(
  db: LocalDb,
  from: string,
  to: string,
): Promise<LocalTimeEntry[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM time_entries WHERE started_at >= ? AND started_at < ? ORDER BY started_at DESC',
    [from, to],
  )
  return rows.map(rowToEntry)
}

/** Start a new timer. Stops any running timer first. */
export async function startEntry(
  db: LocalDb,
  input: { projectId?: string | null; taskId?: string | null; note?: string | null } = {},
): Promise<LocalTimeEntry> {
  // Stop any running timer
  await db.runAsync(
    "UPDATE time_entries SET ended_at = datetime('now'), updated_at = datetime('now') WHERE ended_at IS NULL",
  )
  const id = uuid()
  const now = new Date().toISOString()
  await db.runAsync(
    'INSERT INTO time_entries (id, project_id, task_id, started_at, source, note) VALUES (?, ?, ?, ?, ?, ?)',
    [id, input.projectId ?? null, input.taskId ?? null, now, 'timer', input.note ?? null],
  )
  return {
    id,
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    startedAt: now,
    endedAt: null,
    billable: true,
    source: 'timer',
    note: input.note ?? null,
  }
}

/** Stop the currently running timer. Returns the stopped entry or null. */
export async function stopEntry(db: LocalDb): Promise<LocalTimeEntry | null> {
  const running = await getRunningEntry(db)
  if (!running) return null
  const now = new Date().toISOString()
  await db.runAsync(
    "UPDATE time_entries SET ended_at = ?, updated_at = datetime('now') WHERE id = ?",
    [now, running.id],
  )
  return { ...running, endedAt: now }
}

/** Compute total tracked ms in a date range. */
export async function totalMsInRange(db: LocalDb, from: string, to: string): Promise<number> {
  const entries = await listEntriesInRange(db, from, to)
  let total = 0
  const now = Date.now()
  for (const e of entries) {
    const start = Date.parse(e.startedAt)
    const end = e.endedAt ? Date.parse(e.endedAt) : now
    total += end - start
  }
  return total
}
