import { ensureSchema, type LocalDb, type Row, type SqlValue } from '@mydevtime/local-db'

/** The `expo-sqlite` module namespace — imported lazily (see below), type-only here. */
type ExpoSqlite = typeof import('expo-sqlite')

/**
 * The `expo-sqlite` adapter for the `LocalDb` port (ADR-0040 / ports & adapters).
 * The vendor is imported **lazily**, inside the async open, on purpose: on a target
 * where the native module is unavailable (e.g. the web build until wa-sqlite/OPFS
 * is wired up) the import rejects **here** — where `LocalDbProvider` catches it and
 * degrades to the demo path — instead of throwing at module-eval time and crashing
 * the whole app before it can render (a vendor adapter must never take the app down,
 * ADR-0005). The vendor type stays confined to this file.
 */
export async function openExpoLocalDb(): Promise<LocalDb> {
  const SQLite: ExpoSqlite = await import('expo-sqlite')
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
