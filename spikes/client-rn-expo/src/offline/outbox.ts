/**
 * Spike #1 · Q2 (offline-first persistence + sync fit) — pure logic.
 *
 * Offline-first means: every mutation is written to the local DB immediately and
 * also appended to an *outbox* of pending changes. When connectivity returns the
 * outbox is flushed as a batch of `EntityState` snapshots — exactly the shape the
 * already-built deterministic sync engine (`packages/domain`, REQ-006/ADR-0019)
 * consumes via `applyPush`. This file proves the mapping is clean: local edits →
 * outbox → sync push, with last-writer-wins metadata (`updatedAt`, `deviceId`)
 * stamped at mutation time so the merge is deterministic on the server.
 *
 * `EntityState` here is a structural mirror of the domain type (kept local so the
 * throwaway spike has no build-time dependency on the workspace). The real client
 * imports it from `@mydevtime/domain`.
 */

export type SyncEntityType = 'client' | 'project' | 'task' | 'tag' | 'timeEntry'
export type SyncValue = string | number | boolean | null

export interface EntityState {
  readonly type: SyncEntityType
  readonly id: string
  readonly deletedAt: number | null
  readonly updatedAt: number
  readonly deviceId: string
  readonly fields: Readonly<Record<string, SyncValue>>
}

/** A local mutation captured while (possibly) offline. */
export interface LocalMutation {
  readonly type: SyncEntityType
  readonly id: string
  readonly fields: Readonly<Record<string, SyncValue>>
  readonly deletedAt?: number | null
  /** Device-local logical edit time (epoch-ms) — the LWW key. */
  readonly at: number
}

export interface OutboxEntry extends EntityState {
  /** Monotonic local sequence — preserves per-entity edit order within a flush. */
  readonly seq: number
}

/**
 * Fold local mutations into the outbox. Multiple edits to the same entity while
 * offline coalesce to a single latest snapshot (the newest `at` wins and its
 * fields are merged over the older ones) — so a flush sends one row per entity,
 * not a replay log. This is the offline analogue of the server's LWW.
 */
export function enqueue(
  outbox: readonly OutboxEntry[],
  mutation: LocalMutation,
  deviceId: string,
  seq: number,
): OutboxEntry[] {
  const key = `${mutation.type}:${mutation.id}`
  const existing = outbox.find(e => `${e.type}:${e.id}` === key)
  const merged: OutboxEntry = {
    type: mutation.type,
    id: mutation.id,
    deletedAt: mutation.deletedAt ?? existing?.deletedAt ?? null,
    updatedAt: Math.max(mutation.at, existing?.updatedAt ?? mutation.at),
    deviceId,
    fields: { ...(existing?.fields ?? {}), ...mutation.fields },
    seq: existing ? existing.seq : seq,
  }
  return [...outbox.filter(e => `${e.type}:${e.id}` !== key), merged].sort((a, b) => a.seq - b.seq)
}

/** The batch to hand to the sync engine's `applyPush`, in stable order. */
export function toPush(outbox: readonly OutboxEntry[]): EntityState[] {
  return outbox.map(({ seq: _seq, ...state }) => state)
}

/** After the server acks a flush up to `throughSeq`, drop those entries. */
export function ack(outbox: readonly OutboxEntry[], throughSeq: number): OutboxEntry[] {
  return outbox.filter(e => e.seq > throughSeq)
}
