import { DatabaseSync } from 'node:sqlite'
import type { LocalDb, Row, SqlValue } from '../port.js'
import { ensureSchema } from '../schema.js'

/**
 * A `LocalDb` adapter over Node's built-in `node:sqlite` — **test only** (excluded
 * from the build). It exercises the repositories against a real in-memory SQLite,
 * so the schema, indexes, and isolation are verified for real rather than mocked.
 * The production adapters (`expo-sqlite`, `wa-sqlite`) implement the same port.
 */
export async function openTestDb(): Promise<LocalDb> {
  const sqlite = new DatabaseSync(':memory:')
  const db: LocalDb = {
    execAsync(sql: string): Promise<void> {
      sqlite.exec(sql)
      return Promise.resolve()
    },
    runAsync(sql: string, params: readonly SqlValue[] = []): Promise<{ changes: number }> {
      const result = sqlite.prepare(sql).run(...params)
      return Promise.resolve({ changes: Number(result.changes) })
    },
    getAllAsync<T extends Row = Row>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
      const rows = sqlite.prepare(sql).all(...params)
      return Promise.resolve(rows as unknown as T[])
    },
    getFirstAsync<T extends Row = Row>(
      sql: string,
      params: readonly SqlValue[] = [],
    ): Promise<T | null> {
      const row = sqlite.prepare(sql).get(...params)
      return Promise.resolve((row ?? null) as T | null)
    },
  }
  await ensureSchema(db)
  return db
}
