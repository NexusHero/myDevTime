import SQLiteESMFactory from './wa-sqlite-async.js'
import * as SQLite from 'wa-sqlite'
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js'
import { SCHEMA_SQL, type LocalDb } from './schema.js'

export async function openWebLocalDb(): Promise<LocalDb> {
  // Initialize WebAssembly module
  const module = await SQLiteESMFactory({
    locateFile: (file: string) => `/${file}`,
  })
  const sqlite3 = SQLite.Factory(module)

  // Register IndexedDB VFS for persistence
  const vfs = new IDBBatchAtomicVFS('mydevtime-idb-vfs')
  sqlite3.vfs_register(vfs, true)

  // Open DB
  const db = await sqlite3.open_v2(
    'mydevtime.db',
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    'mydevtime-idb-vfs',
  )

  // Wrap into our LocalDb interface
  const localDb: LocalDb = {
    async execAsync(sql: string) {
      await sqlite3.exec(db, sql)
    },
    async runAsync(sql: string, params?: any[]) {
      let insertId = 0
      let changes = 0
      for await (const stmt of sqlite3.statements(db, sql)) {
        if (params) {
          params.forEach((param, i) => {
            // SQLite binds are 1-indexed. Convert boolean to int if needed.
            const p = typeof param === 'boolean' ? (param ? 1 : 0) : param
            sqlite3.bind(stmt, i + 1, p)
          })
        }
        await sqlite3.step(stmt)
        changes += sqlite3.changes(db)

        // Get the last insert row id via a query because wa-sqlite doesn't export sqlite3_last_insert_rowid
        const lastInsertStmt = await sqlite3
          .statements(db, 'SELECT last_insert_rowid() AS id')
          .next()
        if (!lastInsertStmt.done) {
          if ((await sqlite3.step(lastInsertStmt.value)) === SQLite.SQLITE_ROW) {
            const row = sqlite3.row(lastInsertStmt.value)
            const lastInsert = row[0]
            if (typeof lastInsert === 'bigint') {
              if (lastInsert > 0n) insertId = Number(lastInsert)
            } else if (typeof lastInsert === 'number') {
              if (lastInsert > 0) insertId = lastInsert
            }
          }
          sqlite3.reset(lastInsertStmt.value)
        }

        sqlite3.reset(stmt)
      }
      return { insertId, changes }
    },
    async getAllAsync<T>(sql: string, params?: any[]): Promise<T[]> {
      const results: T[] = []
      for await (const stmt of sqlite3.statements(db, sql)) {
        if (params) {
          params.forEach((param, i) => {
            const p = typeof param === 'boolean' ? (param ? 1 : 0) : param
            sqlite3.bind(stmt, i + 1, p)
          })
        }
        const cols = sqlite3.column_names(stmt)
        while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
          const row: any = {}
          const values = sqlite3.row(stmt)
          cols.forEach((col, i) => {
            row[col] = values[i]
          })
          results.push(row as T)
        }
        sqlite3.reset(stmt)
      }
      return results
    },
    async getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null> {
      const results = await this.getAllAsync<T>(sql, params)
      return results.length > 0 ? results[0] : null
    }
  }

  // Ensure schema and seeds are loaded
  await localDb.execAsync(SCHEMA_SQL)
  const { seedLocalDb } = await import('./seed.js')
  await seedLocalDb(localDb)

  return localDb
}
