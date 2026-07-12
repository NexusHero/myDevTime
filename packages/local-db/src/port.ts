/**
 * The `LocalDb` port (ADR-0040 / ports & adapters). A narrow async SQLite
 * interface the repositories talk to; the vendor drivers implement it in one
 * adapter each — `expo-sqlite` on native, `wa-sqlite` on web (both landed by the
 * app), and a `node:sqlite` adapter for tests. Nothing upstream imports a vendor
 * type. No `any`: parameters and rows are typed scalars.
 */

/** A value that can be bound to a SQL parameter / read from a column. */
export type SqlValue = string | number | null

/** A row is a map of column name → scalar. Repositories map these to entities. */
export type Row = Readonly<Record<string, SqlValue>>

export interface LocalDb {
  /** Run one or more statements with no bound params (schema creation, PRAGMA). */
  execAsync(sql: string): Promise<void>
  /** Run a write statement; returns rows affected. */
  runAsync(sql: string, params?: readonly SqlValue[]): Promise<{ changes: number }>
  /** Read all rows for a query. */
  getAllAsync<T extends Row = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]>
  /** Read the first row for a query, or null. */
  getFirstAsync<T extends Row = Row>(sql: string, params?: readonly SqlValue[]): Promise<T | null>
}

/** Coerce a SQLite integer flag (0/1) to a boolean. */
export function toBool(value: SqlValue): boolean {
  return value === 1 || value === '1'
}

/** Coerce a boolean to the SQLite integer flag it stores as. */
export function fromBool(value: boolean): number {
  return value ? 1 : 0
}
