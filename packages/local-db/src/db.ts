import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import type { LocalDb, SqlValue } from './port.js'
import * as schema from './tables.js'

/**
 * A Drizzle query builder bound to a `LocalDb` port (ADR-0046). Drizzle generates
 * the SQL; our existing port executes it — via the `sqlite-proxy` async driver —
 * so nothing new couples to a vendor SQLite driver, the same code runs on
 * iOS/Android **and** web, and the render-test null path is untouched. The proxy
 * hands Drizzle each row's values in column order (`Object.values`), which is how
 * SQLite returns them, and Drizzle applies its own column mapping (booleans, JSON)
 * on top. Instances are memoised per port so repeated repo calls reuse one.
 */
export type DrizzleDb = SqliteRemoteDatabase<typeof schema>

const cache = new WeakMap<LocalDb, DrizzleDb>()

export function drizzleFor(port: LocalDb): DrizzleDb {
  const cached = cache.get(port)
  if (cached) return cached
  const db = drizzle(
    async (sql: string, params: unknown[], method: string): Promise<{ rows: unknown[] }> => {
      const bound = params as readonly SqlValue[]
      if (method === 'run') {
        await port.runAsync(sql, bound)
        return { rows: [] }
      }
      const rows = await port.getAllAsync(sql, bound)
      const values = rows.map(row => Object.values(row))
      // `get` expects a single row's values; `all` / `values` expect all rows.
      return { rows: method === 'get' ? (values[0] ?? []) : values }
    },
    { schema },
  )
  cache.set(port, db)
  return db
}
