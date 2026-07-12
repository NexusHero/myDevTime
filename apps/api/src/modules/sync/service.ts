import {
  resolve,
  resolveCrudWrite,
  type CrudOp,
  type EntityState,
  type SyncEntityType,
  type SyncValue,
} from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { syncConflicts, syncOperations } from '../../db/schema.js'
import { ValidationError } from '../../errors.js'
import { ADAPTERS, type VersionedState } from './adapters.js'

/**
 * The server sync engine (REQ-006, ADR-0019) — the Postgres edge that mirrors
 * the pure engine's protocol: workspace-scoped, idempotent by operation id,
 * resumable (each change commits independently), and delegating every conflict
 * to the deterministic `resolve`. Deletions ride as tombstones; a surfaced
 * conflict is persisted so the losing version is never lost.
 */

export interface PushChangeInput {
  readonly type: SyncEntityType
  readonly opId: string
  readonly base: EntityState | null
  readonly incoming: EntityState
}

export interface PushResultOut {
  readonly opId: string
  readonly outcome: 'applied' | 'skipped' | 'surfaced'
  readonly version: number
  readonly state: EntityState
}

function sameContent(a: EntityState, b: EntityState): boolean {
  if (a.deletedAt !== b.deletedAt) return false
  const names = new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])
  for (const name of names) {
    const av: SyncValue = a.fields[name] ?? null
    const bv: SyncValue = b.fields[name] ?? null
    if (av !== bv) return false
  }
  return true
}

function assertConsistent(change: PushChangeInput): void {
  if (change.incoming.type !== change.type) {
    throw new ValidationError('sync: change type does not match its payload')
  }
}

/** Apply one pushed change transactionally; returns its result. */
async function applyOne(
  db: Db,
  workspaceId: string,
  change: PushChangeInput,
): Promise<PushResultOut> {
  assertConsistent(change)
  const adapter = ADAPTERS[change.type]

  return db.transaction(async tx => {
    // Idempotency: claim the op id; if already claimed, echo current state.
    const claimed = await tx
      .insert(syncOperations)
      .values({ workspaceId, opId: change.opId })
      .onConflictDoNothing()
      .returning({ opId: syncOperations.opId })
    const current = await adapter.load(tx, workspaceId, change.incoming.id)
    if (claimed.length === 0) {
      const version = current?.version ?? 0
      return {
        opId: change.opId,
        outcome: 'skipped',
        version,
        state: current?.state ?? change.incoming,
      }
    }

    // First time the server sees this entity → insert.
    if (!current) {
      const written = await adapter.persist(tx, workspaceId, change.incoming)
      if (!written) throw new ValidationError('sync: entity id belongs to another workspace')
      return {
        opId: change.opId,
        outcome: 'applied',
        version: written.version,
        state: written.state,
      }
    }

    const base = change.base ?? current.state
    const r = resolve(base, current.state, change.incoming)

    // No real change → don't write (the trigger would churn the version).
    if (r.outcome === 'merged' && sameContent(r.merged, current.state)) {
      return {
        opId: change.opId,
        outcome: 'skipped',
        version: current.version,
        state: current.state,
      }
    }

    const written = await adapter.persist(tx, workspaceId, r.merged)
    if (!written) throw new ValidationError('sync: entity id belongs to another workspace')

    if (r.outcome === 'surfaced' && r.surfaced) {
      await tx.insert(syncConflicts).values({
        workspaceId,
        entityType: change.type,
        entityId: change.incoming.id,
        fields: JSON.stringify(r.surfaced.fields),
        incoming: JSON.stringify(r.surfaced.incoming),
      })
      return {
        opId: change.opId,
        outcome: 'surfaced',
        version: written.version,
        state: written.state,
      }
    }
    return { opId: change.opId, outcome: 'applied', version: written.version, state: written.state }
  })
}

export interface PushResponseOut {
  readonly results: readonly PushResultOut[]
}

/** Apply a batch of pushed changes; each commits on its own, so a mid-batch
 *  failure leaves earlier changes applied and the client can resume. */
export async function pushChanges(
  db: Db,
  workspaceId: string,
  changes: readonly PushChangeInput[],
): Promise<PushResponseOut> {
  const results: PushResultOut[] = []
  for (const change of changes) {
    results.push(await applyOne(db, workspaceId, change))
  }
  return { results }
}

export interface PullChangeOut {
  readonly version: number
  readonly state: EntityState
}

export interface PullResponseOut {
  readonly changes: readonly PullChangeOut[]
  readonly watermark: number
}

/** Everything in the workspace with `version > since`, version-ordered across
 *  all entity types — resumable from the client's watermark. */
export async function pullChanges(
  db: Db,
  workspaceId: string,
  since: number,
): Promise<PullResponseOut> {
  const perType = await Promise.all(
    Object.values(ADAPTERS).map(adapter => adapter.changesSince(db, workspaceId, since)),
  )
  const all: VersionedState[] = perType.flat()
  all.sort((a, b) => a.version - b.version)
  const last = all.at(-1)
  return {
    changes: all.map(v => ({ version: v.version, state: v.state })),
    watermark: last ? last.version : since,
  }
}

// ── PowerSync CRUD upload (ADR-0043) ─────────────────────────────────────────

/**
 * One intercepted local write as PowerSync's `uploadData` sends it: an op, the
 * row id, and — for PUT/PATCH — the changed columns (`opData`) in the canonical
 * `EntityState` field shape (e.g. `startedAt` as epoch-ms). `baseVersion` is the
 * server `version` the client's row was based on (`null` for an offline insert).
 */
export interface CrudWriteInput {
  readonly type: SyncEntityType
  readonly op: CrudOp
  readonly id: string
  readonly data: Readonly<Record<string, SyncValue>>
  readonly baseVersion: number | null
  readonly updatedAt: number
  readonly deviceId: string
}

export interface CrudResultOut {
  readonly id: string
  readonly type: SyncEntityType
  readonly outcome: 'applied' | 'surfaced' | 'noop'
  readonly version: number
  readonly fields?: readonly string[]
}

/**
 * The `EntityState` a write persists: the changed columns merged onto the current
 * row (a delete keeps the payload but stamps a tombstone). Merging onto `current`
 * means a PATCH need only carry the columns it changed.
 */
function nextState(write: CrudWriteInput, current: VersionedState | null): EntityState {
  const baseFields = current ? current.state.fields : {}
  const isDelete = write.op === 'delete'
  return {
    type: write.type,
    id: write.id,
    deletedAt: isDelete ? write.updatedAt : null,
    updatedAt: write.updatedAt,
    deviceId: write.deviceId,
    fields: isDelete ? { ...baseFields } : { ...baseFields, ...write.data },
  }
}

/** Apply one uploaded CRUD write transactionally; returns its result. */
async function applyOneCrud(
  db: Db,
  workspaceId: string,
  write: CrudWriteInput,
): Promise<CrudResultOut> {
  const adapter = ADAPTERS[write.type]
  return db.transaction(async tx => {
    const current = await adapter.load(tx, workspaceId, write.id)
    const server = current
      ? { version: current.version, deleted: current.state.deletedAt !== null }
      : null
    const decision = resolveCrudWrite(
      { type: write.type, op: write.op, changed: write.data, baseVersion: write.baseVersion },
      server,
    )

    if (decision.outcome === 'noop') {
      return { id: write.id, type: write.type, outcome: 'noop', version: current?.version ?? 0 }
    }

    if (decision.outcome === 'surfaced') {
      // Keep the server's authoritative row; record the conflict durably so the
      // losing edit is never lost (REQ-006).
      await tx.insert(syncConflicts).values({
        workspaceId,
        entityType: write.type,
        entityId: write.id,
        fields: JSON.stringify(decision.fields ?? []),
        incoming: JSON.stringify(nextState(write, current)),
      })
      return {
        id: write.id,
        type: write.type,
        outcome: 'surfaced',
        version: current?.version ?? 0,
        ...(decision.fields ? { fields: decision.fields } : {}),
      }
    }

    const written = await adapter.persist(tx, workspaceId, nextState(write, current))
    if (!written) throw new ValidationError('sync: entity id belongs to another workspace')
    return { id: write.id, type: write.type, outcome: 'applied', version: written.version }
  })
}

export interface UploadResponseOut {
  readonly results: readonly CrudResultOut[]
}

/**
 * Apply a batch of PowerSync CRUD uploads (ADR-0043). Each write commits on its
 * own transaction (resumable); conflict resolution is the deterministic
 * `resolveCrudWrite` and persistence reuses the ADR-0019 storage adapters — so a
 * time-entry interval conflict is surfaced (and recorded), never auto-merged.
 */
export async function uploadCrud(
  db: Db,
  workspaceId: string,
  writes: readonly CrudWriteInput[],
): Promise<UploadResponseOut> {
  const results: CrudResultOut[] = []
  for (const write of writes) {
    results.push(await applyOneCrud(db, workspaceId, write))
  }
  return { results }
}
