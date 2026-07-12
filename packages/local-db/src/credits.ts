import type { LocalDb } from './client.js'

export interface LocalCreditEntry {
  readonly id: string
  readonly kind: string
  readonly amount: number
  readonly category: string
  readonly reason: string | null
  readonly at: string
}

function rowToCreditEntry(row: Record<string, unknown>): LocalCreditEntry {
  return {
    id: row['id'] as string,
    kind: row['kind'] as string,
    amount: row['amount'] as number,
    category: row['category'] as string,
    reason: (row['reason'] as string) ?? null,
    at: row['at'] as string,
  }
}

export async function listCreditEntries(db: LocalDb, limit: number = 50): Promise<LocalCreditEntry[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM credit_entries ORDER BY at DESC LIMIT ?',
    [limit]
  )
  return rows.map(rowToCreditEntry)
}

export async function getCreditBalance(db: LocalDb): Promise<number> {
  const row = await db.getFirstAsync<{ balance: number }>(
    'SELECT SUM(amount) as balance FROM credit_entries'
  )
  return row?.balance ?? 0
}

export async function getCreditUsage(db: LocalDb, from: string, to: string): Promise<{ category: string, credits: number }[]> {
  const rows = await db.getAllAsync<{ category: string, credits: number }>(
    'SELECT category, SUM(ABS(amount)) as credits FROM credit_entries WHERE amount < 0 AND at >= ? AND at < ? GROUP BY category',
    [from, to]
  )
  return rows
}
