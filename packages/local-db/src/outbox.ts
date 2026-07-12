import type { EntityState, SyncEntityType } from '@mydevtime/domain'
import type { LocalDb, Row } from './port.js'
import { newId, nowIso } from './ids.js'

/**
 * The client change-log (REQ-006, ADR-0019 client half). Every local mutation
 * appends one op here: the `opId` makes a re-delivered push idempotent, and
 * `base` (the last-synced server snapshot, `null` for an offline insert) plus
 * `baseVersion` let the server's deterministic `resolve` detect a conflict. The
 * store holds the op — it does **no** merge/resolution itself (ADR-0005); the
 * sync engine in `packages/domain` does. Rows are removed once acked.
 *
 * `EntityState` is stored as JSON; it is a pure data type from the sync core, so
 * carrying it here keeps the store thin (no math) while staying type-safe.
 */
export interface OutboxOp {
  readonly opId: string
  readonly workspaceId: string
  readonly entityType: SyncEntityType
  readonly entityId: string
  /** Last-synced server version this edit was based on; `null` for an offline insert. */
  readonly baseVersion: number | null
  /** Snapshot the edit was based on; `null` for an offline insert. */
  readonly base: EntityState | null
  /** The full state to push. */
  readonly incoming: EntityState
  readonly createdAt: string
}

export interface EnqueueOpInput {
  readonly entityType: SyncEntityType
  readonly entityId: string
  readonly baseVersion?: number | null
  readonly base?: EntityState | null
  readonly incoming: EntityState
  /** Provide to reuse a stable op id; otherwise a fresh UUID is generated. */
  readonly opId?: string
}

function toOp(row: Row): OutboxOp {
  const baseState = row.base_state === null ? null : String(row.base_state)
  return {
    opId: String(row.op_id),
    workspaceId: String(row.workspace_id),
    entityType: String(row.entity_type) as SyncEntityType,
    entityId: String(row.entity_id),
    baseVersion: row.base_version === null ? null : Number(row.base_version),
    base: baseState === null ? null : (JSON.parse(baseState) as EntityState),
    incoming: JSON.parse(String(row.incoming_state)) as EntityState,
    createdAt: String(row.created_at),
  }
}

/** Append a pending op to the change-log. Returns the queued op. */
export async function enqueueOp(
  db: LocalDb,
  workspaceId: string,
  input: EnqueueOpInput,
): Promise<OutboxOp> {
  const opId = input.opId ?? newId()
  const createdAt = nowIso()
  const base = input.base ?? null
  const baseVersion = input.baseVersion ?? null
  await db.runAsync(
    `INSERT INTO sync_outbox
       (op_id, workspace_id, entity_type, entity_id, base_version, base_state, incoming_state, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      opId,
      workspaceId,
      input.entityType,
      input.entityId,
      baseVersion,
      base === null ? null : JSON.stringify(base),
      JSON.stringify(input.incoming),
      createdAt,
    ],
  )
  return {
    opId,
    workspaceId,
    entityType: input.entityType,
    entityId: input.entityId,
    baseVersion,
    base,
    incoming: input.incoming,
    createdAt,
  }
}

/** Pending ops for the workspace, oldest first (the order they are pushed). */
export async function listPendingOps(db: LocalDb, workspaceId: string): Promise<OutboxOp[]> {
  const rows = await db.getAllAsync(
    `SELECT op_id, workspace_id, entity_type, entity_id, base_version, base_state, incoming_state, created_at
       FROM sync_outbox
      WHERE workspace_id = ?
      ORDER BY created_at, op_id`,
    [workspaceId],
  )
  return rows.map(toOp)
}

/** Remove ops the server has acknowledged (applied/skipped/surfaced). Idempotent. */
export async function acknowledgeOps(
  db: LocalDb,
  workspaceId: string,
  opIds: readonly string[],
): Promise<void> {
  for (const opId of opIds) {
    await db.runAsync(`DELETE FROM sync_outbox WHERE workspace_id = ? AND op_id = ?`, [
      workspaceId,
      opId,
    ])
  }
}
