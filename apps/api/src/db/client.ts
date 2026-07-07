import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

export type Db = PostgresJsDatabase<typeof schema>

export interface DbHandle {
  db: Db
  /** Underlying driver — for readiness pings and graceful shutdown. */
  sql: postgres.Sql
  close: () => Promise<void>
}

/**
 * Create the database handle. The `postgres`/Drizzle driver is the only vendor
 * surface for persistence — it lives here and nothing in `packages/domain` ever
 * imports it (ADR-0005). One handle per process, closed on shutdown.
 */
export function createDb(databaseUrl: string): DbHandle {
  const sql = postgres(databaseUrl, { max: 10 })
  const db = drizzle(sql, { schema })
  return {
    db,
    sql,
    close: async () => {
      await sql.end({ timeout: 5 })
    },
  }
}
