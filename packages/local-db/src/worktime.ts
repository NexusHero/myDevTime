import type { LocalDb } from './client.js'

export interface LocalShift {
  readonly id: string
  readonly startedAt: string
  readonly endedAt: string | null
  readonly breakMs: number
  readonly source: string
  readonly breakShortfallMs: number
}

function rowToShift(row: Record<string, unknown>): LocalShift {
  return {
    id: String(row.id),
    startedAt: String(row.started_at),
    endedAt: row.ended_at ? String(row.ended_at) : null,
    breakMs: Number(row.break_ms),
    source: String(row.source),
    breakShortfallMs: Number(row.break_shortfall_ms),
  }
}

export async function listShifts(db: LocalDb): Promise<LocalShift[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM shifts ORDER BY started_at DESC',
  )
  return rows.map(rowToShift)
}

export async function getRunningShift(db: LocalDb): Promise<LocalShift | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM shifts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
  )
  return row ? rowToShift(row) : null
}

export async function clockIn(db: LocalDb): Promise<LocalShift> {
  const id =
    (globalThis as any).crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const startedAt = new Date().toISOString()
  await db.runAsync(
    'INSERT INTO shifts (id, started_at, break_ms, source, break_shortfall_ms) VALUES (?, ?, 0, ?, 0)',
    [id, startedAt, 'clock'],
  )
  return {
    id,
    startedAt,
    endedAt: null,
    breakMs: 0,
    source: 'clock',
    breakShortfallMs: 0,
  }
}

export async function clockOut(db: LocalDb, id: string): Promise<void> {
  const endedAt = new Date().toISOString()
  await db.runAsync('UPDATE shifts SET ended_at = ? WHERE id = ? AND ended_at IS NULL', [
    endedAt,
    id,
  ])
}
