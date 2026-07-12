import type { EntityState, SyncEntityType, SyncValue } from '@mydevtime/domain'
import { fromBool, type LocalDb } from './port.js'

/**
 * Client-side sync mapping (REQ-006, ADR-0019): apply a server `EntityState` onto
 * the matching local row. This is the client counterpart of the server's storage
 * adapters — server-authoritative, so a pulled state (with its server `version`)
 * overwrites the local row, tombstones included. The mapping covers the fields the
 * local store actually holds; server-only columns (a project's `hourlyRateOverride`,
 * an entry's `userId`) are not mirrored locally and are simply ignored.
 *
 * No merge/resolution happens here (that is the `packages/domain` engine, ADR-0005);
 * this only writes the authoritative row the engine already decided on.
 */

function str(v: SyncValue | undefined): string {
  return typeof v === 'string' ? v : ''
}
function strOrNull(v: SyncValue | undefined): string | null {
  return typeof v === 'string' ? v : null
}
function boolInt(v: SyncValue | undefined, fallback = true): number {
  return fromBool(typeof v === 'boolean' ? v : fallback)
}
function msToIso(v: SyncValue | undefined): string | null {
  return typeof v === 'number' ? new Date(v).toISOString() : null
}

/** Columns every syncable row carries (ADR-0040). */
interface SyncCols {
  readonly updatedAt: string
  readonly deletedAt: string | null
  readonly version: number
}

function syncCols(version: number, state: EntityState): SyncCols {
  return {
    updatedAt: new Date(state.updatedAt).toISOString(),
    deletedAt: state.deletedAt === null ? null : new Date(state.deletedAt).toISOString(),
    version,
  }
}

/**
 * Per-entity upsert: INSERT the row, or UPDATE it in place when its id already
 * exists. `created_at` is set on insert (from the edit time) and left untouched on
 * update. The write is workspace-stamped, so a pulled row always lands in `ws`.
 */
type Upsert = (
  db: LocalDb,
  ws: string,
  id: string,
  f: EntityState['fields'],
  c: SyncCols,
) => Promise<void>

const upserts: Record<SyncEntityType, Upsert | undefined> = {
  client: async (db, ws, id, f, c) => {
    await db.runAsync(
      `INSERT INTO clients (id, workspace_id, name, archived, created_at, updated_at, version, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, archived = excluded.archived,
         updated_at = excluded.updated_at, version = excluded.version, deleted_at = excluded.deleted_at`,
      [
        id,
        ws,
        str(f.name),
        boolInt(f.archived, false),
        c.updatedAt,
        c.updatedAt,
        c.version,
        c.deletedAt,
      ],
    )
  },
  project: async (db, ws, id, f, c) => {
    await db.runAsync(
      `INSERT INTO projects (id, workspace_id, client_id, name, color, billable_default, archived, created_at, updated_at, version, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         client_id = excluded.client_id, name = excluded.name, color = excluded.color,
         billable_default = excluded.billable_default, archived = excluded.archived,
         updated_at = excluded.updated_at, version = excluded.version, deleted_at = excluded.deleted_at`,
      [
        id,
        ws,
        strOrNull(f.clientId),
        str(f.name),
        strOrNull(f.color),
        boolInt(f.billableDefault),
        boolInt(f.archived, false),
        c.updatedAt,
        c.updatedAt,
        c.version,
        c.deletedAt,
      ],
    )
  },
  task: async (db, ws, id, f, c) => {
    await db.runAsync(
      `INSERT INTO tasks (id, workspace_id, project_id, name, billable_default, archived, created_at, updated_at, version, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         project_id = excluded.project_id, name = excluded.name,
         billable_default = excluded.billable_default, archived = excluded.archived,
         updated_at = excluded.updated_at, version = excluded.version, deleted_at = excluded.deleted_at`,
      [
        id,
        ws,
        str(f.projectId),
        str(f.name),
        boolInt(f.billableDefault),
        boolInt(f.archived, false),
        c.updatedAt,
        c.updatedAt,
        c.version,
        c.deletedAt,
      ],
    )
  },
  timeEntry: async (db, ws, id, f, c) => {
    await db.runAsync(
      `INSERT INTO time_entries (id, workspace_id, project_id, task_id, started_at, ended_at, billable, source, note, created_at, updated_at, version, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         project_id = excluded.project_id, task_id = excluded.task_id,
         started_at = excluded.started_at, ended_at = excluded.ended_at,
         billable = excluded.billable, source = excluded.source, note = excluded.note,
         updated_at = excluded.updated_at, version = excluded.version, deleted_at = excluded.deleted_at`,
      [
        id,
        ws,
        strOrNull(f.projectId),
        strOrNull(f.taskId),
        msToIso(f.startedAt) ?? c.updatedAt,
        msToIso(f.endedAt),
        boolInt(f.billable),
        str(f.source) || 'timer',
        strOrNull(f.note),
        c.updatedAt,
        c.updatedAt,
        c.version,
        c.deletedAt,
      ],
    )
  },
  tag: undefined, // no local tags table yet
}

/** Apply one pulled server change (its `version` + `state`) onto the local store. */
export async function applyServerChange(
  db: LocalDb,
  workspaceId: string,
  version: number,
  state: EntityState,
): Promise<void> {
  const upsert = upserts[state.type]
  if (!upsert) return // an entity type the local store does not keep — skip
  await upsert(db, workspaceId, state.id, state.fields, syncCols(version, state))
}
