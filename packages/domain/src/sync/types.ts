/**
 * Types for the deterministic sync core (REQ-006, ADR-0019). Pure data — no I/O,
 * no framework, no vendor types. Instants are absolute epoch-ms (like the
 * tracking core), so the merge is deterministic given its inputs.
 */

/** Entity types that sync between devices (workspaces are provisioned server-side). */
export type SyncEntityType = 'client' | 'project' | 'task' | 'tag' | 'timeEntry'

/** The value of a syncable field. Entities at 1.0 hold only scalar/nullable fields. */
export type SyncValue = string | number | boolean | null

/**
 * A snapshot of one entity at one point in time — the unit the sync protocol
 * moves and merges. `deletedAt` non-null is a tombstone (deletions sync like any
 * change). `updatedAt`/`deviceId` are the deterministic ordering key for
 * last-writer-wins; `fields` is the entity payload minus these sync-metadata
 * columns.
 */
export interface EntityState {
  readonly type: SyncEntityType
  readonly id: string
  /** Tombstone marker: epoch-ms of deletion, or null while live. */
  readonly deletedAt: number | null
  /** Logical edit time, epoch-ms — the primary last-writer-wins key. */
  readonly updatedAt: number
  /** Originating device — the deterministic tie-break when `updatedAt` ties. */
  readonly deviceId: string
  /** Entity payload keyed by column name (e.g. `name`, `startedAt`, `billable`). */
  readonly fields: Readonly<Record<string, SyncValue>>
}

/**
 * The outcome of merging a conflicting change:
 * - `merged` — `merged` is the authoritative state to persist; the conflict was
 *   settled by a rule (last-writer-wins, or non-overlapping field changes).
 * - `surfaced` — a conflict a rule must NOT settle silently (a time entry's
 *   interval, or delete-vs-edit on a time entry). `merged` keeps the server's
 *   authoritative row (interval untouched, non-interval fields still merged);
 *   `surfaced` carries the incoming version and the conflicting fields for the
 *   caller to record and the user to resolve (REQ-006).
 */
export interface Resolution {
  readonly outcome: 'merged' | 'surfaced'
  readonly merged: EntityState
  readonly surfaced?: {
    readonly fields: readonly string[]
    readonly incoming: EntityState
  }
}
