import type * as SQLite from 'expo-sqlite'
import { SCHEMA_SQL, type LocalDb } from './schema.js'
export type { LocalDb }

/**
 * Open (or create) the local SQLite database using expo-sqlite and ensure all tables exist.
 * This is the Native (iOS/Android) implementation.
 */
export async function openLocalDb(sqlite: typeof SQLite): Promise<LocalDb> {
  const db = await sqlite.openDatabaseAsync('mydevtime.db')
  await db.execAsync(SCHEMA_SQL)
  const { seedLocalDb } = await import('./seed.js')
  await seedLocalDb(db)
  return db
}
