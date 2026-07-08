import { resolve } from './resolve.js'
import type { EntityState, SyncEntityType, SyncValue } from './types.js'

/**
 * The deterministic sync engine (REQ-006, ADR-0019). Server-authoritative delta
 * sync as a pure function over an in-memory state — no I/O, no storage vendor.
 * The Postgres/HTTP adapter (Phase 2c) implements the same protocol at the edge;
 * keeping the engine pure is what lets the convergence tests prove "no lost or
 * duplicated minutes" for arbitrary interleavings without a database (ADR-0005).
 *
 * One `SyncServer` models one workspace — workspace isolation is a property of
 * having separate servers, so the engine never crosses workspaces.
 */

/** A stored entity plus the server-assigned monotonic version. */
export interface ServerRecord {
  readonly version: number
  readonly state: EntityState
}

/** Authoritative per-workspace state: entities by key, the version counter, and
 *  the set of applied operation ids (idempotency). */
export interface SyncServer {
  readonly records: ReadonlyMap<string, ServerRecord>
  readonly seq: number
  readonly appliedOps: ReadonlySet<string>
}

export function emptyServer(): SyncServer {
  return { records: new Map(), seq: 0, appliedOps: new Set() }
}

export function entityKey(type: SyncEntityType, id: string): string {
  return `${type}:${id}`
}

/** One pushed change. `base` is the client's last-synced snapshot (null when the
 *  client created the entity offline — an insert). `opId` is stable per change so
 *  re-delivery is idempotent. */
export interface PushChange {
  readonly opId: string
  readonly base: EntityState | null
  readonly incoming: EntityState
}

export interface PushResult {
  readonly opId: string
  readonly outcome: 'applied' | 'skipped' | 'surfaced'
  readonly version: number
  readonly state: EntityState
  readonly conflict?: { readonly fields: readonly string[]; readonly incoming: EntityState }
}

export interface PushResponse {
  readonly server: SyncServer
  readonly results: readonly PushResult[]
}

/** Two states are equal for churn detection when their tombstone and payload
 *  match — sync metadata (updatedAt/deviceId) is ordering, not content. */
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

/**
 * Apply a batch of pushed changes. Idempotent (a re-delivered `opId` is a no-op
 * that echoes current state), version-bumping only on a real content change (so
 * no-ops don't churn the pull cursor), and delegating every genuine conflict to
 * the deterministic `resolve`. Returns a NEW server — the input is never mutated,
 * so a caller can discard the result on failure and retry (resumable).
 */
export function applyPush(server: SyncServer, changes: readonly PushChange[]): PushResponse {
  const records = new Map(server.records)
  const appliedOps = new Set(server.appliedOps)
  let seq = server.seq
  const results: PushResult[] = []

  for (const change of changes) {
    const key = entityKey(change.incoming.type, change.incoming.id)
    const existing = records.get(key)

    // Idempotency: an already-applied op just echoes the current server state.
    if (appliedOps.has(change.opId)) {
      if (existing) {
        results.push({
          opId: change.opId,
          outcome: 'skipped',
          version: existing.version,
          state: existing.state,
        })
      }
      continue
    }
    appliedOps.add(change.opId)

    // First time the server sees this entity → insert as-is.
    if (!existing) {
      seq += 1
      const state = change.incoming
      records.set(key, { version: seq, state })
      results.push({ opId: change.opId, outcome: 'applied', version: seq, state })
      continue
    }

    const base = change.base ?? existing.state
    const r = resolve(base, existing.state, change.incoming)

    // No real change (stale or already-known edit) → don't advance the version.
    if (r.outcome === 'merged' && sameContent(r.merged, existing.state)) {
      results.push({
        opId: change.opId,
        outcome: 'skipped',
        version: existing.version,
        state: existing.state,
      })
      continue
    }

    seq += 1
    records.set(key, { version: seq, state: r.merged })
    if (r.outcome === 'surfaced' && r.surfaced) {
      results.push({
        opId: change.opId,
        outcome: 'surfaced',
        version: seq,
        state: r.merged,
        conflict: r.surfaced,
      })
    } else {
      results.push({ opId: change.opId, outcome: 'applied', version: seq, state: r.merged })
    }
  }

  return { server: { records, seq, appliedOps }, results }
}

export interface PullResponse {
  /** Records with `version > watermark`, in version order (deletions included as tombstones). */
  readonly changes: readonly ServerRecord[]
  /** The client's new watermark — unchanged when nothing is newer. */
  readonly watermark: number
}

/** Everything the client hasn't seen yet, oldest-first, resumable from `watermark`. */
export function pull(server: SyncServer, watermark: number): PullResponse {
  const changes = [...server.records.values()]
    .filter(record => record.version > watermark)
    .sort((a, b) => a.version - b.version)
  const last = changes.at(-1)
  return { changes, watermark: last ? last.version : watermark }
}
