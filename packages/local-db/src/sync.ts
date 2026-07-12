import type { EntityState, SyncEntityType } from '@mydevtime/domain'
import type { LocalDb } from './port.js'
import { acknowledgeOps, listPendingOps } from './outbox.js'
import { getSyncState, setWatermark } from './syncState.js'
import { applyServerChange } from './syncMapping.js'

/**
 * The client sync orchestrator (REQ-006, ADR-0019 client half). One `runSync`
 * drives the tested `packages/domain` engine over the network: push the local
 * change-log, then pull server deltas above the watermark and apply them. The
 * network is an injected `SyncTransport` port — the HTTP adapter lives in the app,
 * and tests drive the very same loop against the pure domain engine as a fake
 * server (true convergence, no mock). Conflict resolution stays server-side in the
 * engine; `runSync` only records the conflicts it surfaces for the user.
 *
 * Idempotent + resumable: acks clear pushed ops (a re-delivered push is a server
 * no-op), and the watermark only advances after deltas apply, so an interrupted
 * run resumes from the last acked version. Standalone callers never invoke this.
 */
export interface SyncPushChange {
  readonly type: SyncEntityType
  readonly opId: string
  readonly base: EntityState | null
  readonly incoming: EntityState
}

export interface SyncConflict {
  readonly fields: readonly string[]
  readonly incoming: EntityState
}

export interface SyncPushResult {
  readonly opId: string
  readonly outcome: 'applied' | 'skipped' | 'surfaced'
  readonly version: number
  readonly state: EntityState
  readonly conflict?: SyncConflict
}

export interface SyncPullChange {
  readonly version: number
  readonly state: EntityState
}

export interface SyncPullResponse {
  readonly changes: readonly SyncPullChange[]
  readonly watermark: number
}

/** The transport the orchestrator drives — the `/api/sync` contract, injectable. */
export interface SyncTransport {
  push(changes: readonly SyncPushChange[]): Promise<readonly SyncPushResult[]>
  pull(since: number): Promise<SyncPullResponse>
}

export interface SyncOutcome {
  /** Ops sent in this run. */
  readonly pushed: number
  /** Conflicts the server surfaced (interval / delete-vs-edit) for the user to resolve. */
  readonly surfaced: readonly SyncPushResult[]
  /** Server deltas applied to the local store. */
  readonly pulled: number
  /** The watermark after the run. */
  readonly watermark: number
}

/** Push the change-log, then pull + apply server deltas. Returns a run summary. */
export async function runSync(
  db: LocalDb,
  workspaceId: string,
  transport: SyncTransport,
): Promise<SyncOutcome> {
  // 1. Push the local change-log. Every returned op is acked (applied, skipped —
  //    a re-delivery no-op — or surfaced); surfaced conflicts are reported up.
  const ops = await listPendingOps(db, workspaceId)
  let surfaced: SyncPushResult[] = []
  if (ops.length > 0) {
    const results = await transport.push(
      ops.map(o => ({ type: o.entityType, opId: o.opId, base: o.base, incoming: o.incoming })),
    )
    await acknowledgeOps(
      db,
      workspaceId,
      results.map(r => r.opId),
    )
    surfaced = results.filter(r => r.outcome === 'surfaced')
  }

  // 2. Pull everything above the watermark and apply it (server-authoritative),
  //    then advance the watermark last so an interruption safely resumes.
  const { watermark } = await getSyncState(db, workspaceId)
  const response = await transport.pull(watermark)
  for (const change of response.changes) {
    await applyServerChange(db, workspaceId, change.version, change.state)
  }
  await setWatermark(db, workspaceId, response.watermark)

  return {
    pushed: ops.length,
    surfaced,
    pulled: response.changes.length,
    watermark: response.watermark,
  }
}
