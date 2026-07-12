import type { LocalDb } from './client.js'

export interface LocalAbsence {
  readonly id: string
  readonly kind: 'sick' | 'vacation' | 'holiday'
  readonly startDate: string
  readonly endDate: string
  readonly halfDay: boolean
  readonly note: string | null
}

function uuid(): string {
  return (
    (globalThis as any).crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

function rowToAbsence(row: Record<string, unknown>): LocalAbsence {
  return {
    id: row['id'] as string,
    kind: row['kind'] as 'sick' | 'vacation' | 'holiday',
    startDate: row['start_date'] as string,
    endDate: row['end_date'] as string,
    halfDay: (row['half_day'] as number) === 1,
    note: (row['note'] as string) ?? null,
  }
}

export async function listAbsencesInRange(
  db: LocalDb,
  from: string,
  to: string,
): Promise<LocalAbsence[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM absences WHERE start_date <= ? AND end_date >= ? ORDER BY start_date ASC',
    [to, from],
  )
  return rows.map(rowToAbsence)
}

export async function createAbsence(
  db: LocalDb,
  input: Omit<LocalAbsence, 'id'>,
): Promise<LocalAbsence> {
  const id = uuid()
  await db.runAsync(
    'INSERT INTO absences (id, kind, start_date, end_date, half_day, note) VALUES (?, ?, ?, ?, ?, ?)',
    [id, input.kind, input.startDate, input.endDate, input.halfDay ? 1 : 0, input.note ?? null],
  )
  return { ...input, id }
}
