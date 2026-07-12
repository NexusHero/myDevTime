import type { SyncEntityType, SyncValue } from './types.js'

/**
 * Conflict decision for a single PowerSync-style CRUD upload (REQ-006, ADR-0019;
 * adopted transport ADR-0043). PowerSync intercepts every local SQLite write into
 * a queue of `CrudEntry`s — `op` (PUT/PATCH/DELETE), the row `id`, and `opData`
 * (the **changed columns** only). The backend `uploadData` endpoint applies them,
 * and *it* owns conflict resolution (PowerSync itself never merges).
 *
 * This pure function is that policy, kept in the deterministic core so it is
 * exhaustively tested and vendor-free (ADR-0005). It reuses the ADR-0019 rule:
 * catalog collisions are last-writer-wins; a **time entry's interval** collision
 * (or a delete-vs-edit on a time entry) is **surfaced, never auto-merged** — the
 * money is never silently rewritten.
 *
 * Unlike the three-way `resolve`, a CRUD upload carries no base *snapshot* — only
 * the changed fields plus the server `version` the client's row was based on. So
 * "did the other side also touch this?" is inferred from a **version bump** since
 * that base. That is conservative by design: it may surface a collision the
 * three-way merge could have auto-resolved, but it can never *miss* one — the safe
 * direction for durations.
 */

export type CrudOp = 'put' | 'patch' | 'delete'

/** Time-entry fields whose collision must be surfaced, not auto-merged. */
const INTERVAL_FIELDS: readonly string[] = ['startedAt', 'endedAt']

/** One intercepted local write, as PowerSync uploads it. */
export interface CrudWrite {
  readonly type: SyncEntityType
  readonly op: CrudOp
  /** The changed columns (PowerSync `opData`); empty for a delete. */
  readonly changed: Readonly<Record<string, SyncValue>>
  /** Server `version` the client's local row was based on; `null` for an offline insert. */
  readonly baseVersion: number | null
}

/** The server's current view of the row (from its `version`/`deleted_at`), or `null` if absent. */
export interface ServerRow {
  readonly version: number
  readonly deleted: boolean
}

export interface CrudDecision {
  /**
   * - `applied`  — persist the write (insert / last-writer-wins update / delete).
   * - `surfaced` — a conflict a rule must not settle silently; record it and keep the
   *   server's authoritative row. `fields` names the colliding fields.
   * - `noop`     — nothing to do (e.g. deleting an already-absent row).
   */
  readonly outcome: 'applied' | 'surfaced' | 'noop'
  readonly fields?: readonly string[]
}

function touchedIntervalFields(changed: Readonly<Record<string, SyncValue>>): string[] {
  return INTERVAL_FIELDS.filter(f => f in changed)
}

/** Did the server row advance past the version the client based this write on? */
function serverMovedSinceBase(write: CrudWrite, current: ServerRow | null): boolean {
  return current !== null && write.baseVersion !== null && current.version !== write.baseVersion
}

const applied: CrudDecision = { outcome: 'applied' }
const noop: CrudDecision = { outcome: 'noop' }
const surfacedDelete: CrudDecision = { outcome: 'surfaced', fields: ['deletedAt'] }

/**
 * Decide how the backend should treat one uploaded CRUD write, given the server's
 * current row. Pure and total.
 */
export function resolveCrudWrite(write: CrudWrite, current: ServerRow | null): CrudDecision {
  const isTimeEntry = write.type === 'timeEntry'
  const moved = serverMovedSinceBase(write, current)

  if (write.op === 'delete') {
    if (current === null || current.deleted) return noop // already gone — idempotent
    // Deleting a row someone else edited since our base: for a time entry that is a
    // delete-vs-edit — surface it rather than erase edited minutes.
    if (isTimeEntry && moved) return surfacedDelete
    return applied
  }

  // PUT of a brand-new id (or PATCH of a row the server has never seen) — no conflict.
  if (current === null) return applied

  // Edit against a server tombstone: the row was deleted elsewhere. For a time entry
  // that is an edit-vs-delete — surface, don't silently resurrect edited minutes.
  if (current.deleted) {
    return isTimeEntry ? surfacedDelete : applied
  }

  // Row is live. Without a concurrent server change, the write applies as-is.
  if (!moved) return applied

  // Concurrent server change since our base. A time entry whose interval we also
  // touched is a genuine interval collision — surface those fields; everything else
  // (non-interval fields, or any catalog entity) is last-writer-wins.
  if (isTimeEntry) {
    const interval = touchedIntervalFields(write.changed)
    if (interval.length > 0) return { outcome: 'surfaced', fields: interval }
  }
  return applied
}
