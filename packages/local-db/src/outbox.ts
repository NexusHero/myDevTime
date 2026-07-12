import { and, eq, inArray } from 'drizzle-orm'
import type { EntityState, SyncEntityType } from '@mydevtime/domain'
import type { LocalDb } from './port.js'
import { drizzleFor } from './db.js'
import { syncOutbox } from './tables.js'
import { newId, nowIso } from './ids.js'

/**
 * The client change-log (REQ-006, ADR-0019 client half). Every local mutation
 * appends one op here: the `opId` makes a re-delivered push idempotent, and
 * `base` (the last-synced server snapshot, `null` for an offline insert) plus
 * `baseVersion` let the server's deterministic `resolve` detect a conflict. The
 * store holds the op — it does **no** merge/resolution itself (ADR-0005); the
 * sync engine in `packages/domain` does. Rows are removed once acked.
 *
 * `EntityState` is stored in JSON columns (Drizzle serializes/parses them, so
 * `base`/`incoming` are typed values, not strings — ADR-0046).
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

const cols = {
  opId: syncOutbox.opId,
  workspaceId: syncOutbox.workspaceId,
  entityType: syncOutbox.entityType,
  entityId: syncOutbox.entityId,
  baseVersion: syncOutbox.baseVersion,
  base: syncOutbox.baseState,
  incoming: syncOutbox.incomingState,
  createdAt: syncOutbox.createdAt,
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
  await drizzleFor(db).insert(syncOutbox).values({
    opId,
    workspaceId,
    entityType: input.entityType,
    entityId: input.entityId,
    baseVersion,
    baseState: base,
    incomingState: input.incoming,
    createdAt,
  })
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
  return drizzleFor(db)
    .select(cols)
    .from(syncOutbox)
    .where(eq(syncOutbox.workspaceId, workspaceId))
    .orderBy(syncOutbox.createdAt, syncOutbox.opId)
}

/** Remove ops the server has acknowledged (applied/skipped/surfaced). Idempotent. */
export async function acknowledgeOps(
  db: LocalDb,
  workspaceId: string,
  opIds: readonly string[],
): Promise<void> {
  if (opIds.length === 0) return
  await drizzleFor(db)
    .delete(syncOutbox)
    .where(and(eq(syncOutbox.workspaceId, workspaceId), inArray(syncOutbox.opId, [...opIds])))
}
