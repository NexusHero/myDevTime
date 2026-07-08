import * as SQLite from 'expo-sqlite'
import { enqueue, toPush, type EntityState, type OutboxEntry, type SyncValue } from './outbox.js'

/**
 * Q2 surface: an offline-first local store on expo-sqlite. Every write lands in
 * the local table *and* the outbox in one transaction, so the UI is instant and
 * fully functional with no network; `pendingPush()` yields exactly the
 * `EntityState[]` the sync engine's `applyPush` consumes when connectivity
 * returns. Repository APIs take `workspaceId` non-optionally (workspace isolation
 * by construction, per the process rules).
 */
const DDL = `
CREATE TABLE IF NOT EXISTS entries (
  workspace_id TEXT NOT NULL,
  id TEXT NOT NULL,
  note TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  billable INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, id)
);
CREATE TABLE IF NOT EXISTS outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  fields TEXT NOT NULL
);`

export interface EntriesRepo {
  upsert(workspaceId: string, id: string, fields: Record<string, SyncValue>): Promise<void>
  list(workspaceId: string): Promise<Array<Record<string, SyncValue>>>
  pendingPush(workspaceId: string): Promise<EntityState[]>
}

export async function createEntriesRepo(deviceId: string): Promise<EntriesRepo> {
  const db = await SQLite.openDatabaseAsync('mydevtime-spike.db')
  await db.execAsync(DDL)
  return {
    async upsert(workspaceId, id, fields) {
      const at = Date.now()
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO entries (workspace_id, id, note, started_at, ended_at, billable)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(workspace_id, id) DO UPDATE SET
             note=excluded.note, started_at=excluded.started_at,
             ended_at=excluded.ended_at, billable=excluded.billable`,
          workspaceId,
          id,
          (fields.note as string) ?? null,
          (fields.startedAt as number) ?? null,
          (fields.endedAt as number) ?? null,
          fields.billable ? 1 : 0,
        )
        await db.runAsync(
          `INSERT INTO outbox (workspace_id, entity_type, entity_id, device_id, updated_at, deleted_at, fields)
           VALUES (?, 'timeEntry', ?, ?, ?, NULL, ?)`,
          workspaceId,
          id,
          deviceId,
          at,
          JSON.stringify(fields),
        )
      })
    },
    async list(workspaceId) {
      return db.getAllAsync<Record<string, SyncValue>>(
        'SELECT id, note, started_at, ended_at, billable FROM entries WHERE workspace_id = ? ORDER BY started_at DESC',
        workspaceId,
      )
    },
    async pendingPush(workspaceId) {
      const rows = await db.getAllAsync<{
        seq: number
        entity_type: string
        entity_id: string
        device_id: string
        updated_at: number
        deleted_at: number | null
        fields: string
      }>('SELECT * FROM outbox WHERE workspace_id = ? ORDER BY seq', workspaceId)
      // Reuse the pure coalescing logic so the flush is one row per entity.
      let box: OutboxEntry[] = []
      for (const r of rows) {
        box = enqueue(
          box,
          {
            type: 'timeEntry',
            id: r.entity_id,
            fields: JSON.parse(r.fields) as Record<string, SyncValue>,
            deletedAt: r.deleted_at,
            at: r.updated_at,
          },
          r.device_id,
          r.seq,
        )
      }
      return toPush(box)
    },
  }
}
