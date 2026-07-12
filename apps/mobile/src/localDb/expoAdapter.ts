import * as SQLite from 'expo-sqlite'
import { ensureSchema, type LocalDb, type Row, type SqlValue } from '@mydevtime/local-db'

/**
 * The `expo-sqlite` adapter for the `LocalDb` port (ADR-0040 / ports & adapters).
 * `expo-sqlite` works on iOS, Android **and** web (via wa-sqlite/OPFS), so this one
 * adapter covers all three targets — including the Windows/Mac web build. The
 * vendor type (`expo-sqlite`) is confined to this file; nothing upstream imports it.
 */
export async function openExpoLocalDb(): Promise<LocalDb> {
  const sqlite = await SQLite.openDatabaseAsync('mydevtime.db')
  const db: LocalDb = {
    async execAsync(sql: string): Promise<void> {
      await sqlite.execAsync(sql)
    },
    async runAsync(sql: string, params: readonly SqlValue[] = []): Promise<{ changes: number }> {
      const result = await sqlite.runAsync(sql, params as SqlValue[])
      return { changes: result.changes }
    },
    async getAllAsync<T extends Row = Row>(
      sql: string,
      params: readonly SqlValue[] = [],
    ): Promise<T[]> {
      return sqlite.getAllAsync<T>(sql, params as SqlValue[])
    },
    async getFirstAsync<T extends Row = Row>(
      sql: string,
      params: readonly SqlValue[] = [],
    ): Promise<T | null> {
      return sqlite.getFirstAsync<T>(sql, params as SqlValue[])
    },
  }
  await ensureSchema(db)
  return db
}
