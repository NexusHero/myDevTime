import type { EntityState, Resolution, SyncValue } from './types.js'

/**
 * Deterministic conflict resolution for cross-device sync (REQ-006, ADR-0019).
 * Pure and total: given the same three snapshots it always returns the same
 * result, so the simulation/convergence tests can prove "no lost or duplicated
 * minutes" without any I/O.
 *
 * It is a **three-way merge**. `base` is the last state both sides agreed on
 * (the pushing client's last-synced snapshot); `current` is the server's state
 * now; `incoming` is the client's new local state. Comparing each side against
 * `base` tells us who actually changed what, so non-overlapping edits merge and
 * only genuine field collisions need a policy — no server-side version history
 * required.
 *
 * The policy is per entity type:
 * - **Catalog** (client/project/task/tag): last-writer-wins on any collision —
 *   losing a rename or colour is low-harm and recoverable.
 * - **Time entries**: non-interval fields (`note`, `billable`, …) still merge,
 *   but a collision on the interval (`startedAt`/`endedAt`) or a delete-vs-edit
 *   is **surfaced**, never auto-merged — the money is never silently rewritten.
 */

/** Fields of a time entry whose collision must be surfaced, not auto-merged. */
const INTERVAL_FIELDS: readonly string[] = ['startedAt', 'endedAt']

function assertSame(base: EntityState, current: EntityState, incoming: EntityState): void {
  if (base.id !== current.id || current.id !== incoming.id) {
    throw new Error('resolve: snapshots refer to different entities')
  }
  if (base.type !== current.type || current.type !== incoming.type) {
    throw new Error('resolve: snapshots have mismatched entity types')
  }
}

/** Deterministic last-writer-wins: later `updatedAt`, tie broken by `deviceId`. */
function prefersIncoming(current: EntityState, incoming: EntityState): boolean {
  if (incoming.updatedAt !== current.updatedAt) return incoming.updatedAt > current.updatedAt
  return incoming.deviceId > current.deviceId
}

function eq(a: SyncValue | undefined, b: SyncValue | undefined): boolean {
  return a === b
}

/** Did `next` change any payload field relative to `base` (ignoring deletion)? */
function fieldsChanged(base: EntityState, next: EntityState): boolean {
  const names = new Set([...Object.keys(base.fields), ...Object.keys(next.fields)])
  for (const name of names) {
    if (!eq(base.fields[name], next.fields[name])) return true
  }
  return false
}

function withFields(winner: EntityState, fields: Record<string, SyncValue>): EntityState {
  return {
    type: winner.type,
    id: winner.id,
    deletedAt: null,
    updatedAt: winner.updatedAt,
    deviceId: winner.deviceId,
    fields,
  }
}

export function resolve(
  base: EntityState,
  current: EntityState,
  incoming: EntityState,
): Resolution {
  assertSame(base, current, incoming)
  const isTimeEntry = incoming.type === 'timeEntry'

  const incDeleted = incoming.deletedAt !== null
  const curDeleted = current.deletedAt !== null

  // Both sides deleted → the tombstone is uncontested; keep the later one.
  if (incDeleted && curDeleted) {
    return { outcome: 'merged', merged: prefersIncoming(current, incoming) ? incoming : current }
  }

  // Exactly one side deleted.
  if (incDeleted !== curDeleted) {
    const survivor = incDeleted ? current : incoming // the side that did NOT delete
    // If the surviving side made no edits, the deletion is uncontested.
    if (!fieldsChanged(base, survivor)) {
      return { outcome: 'merged', merged: incDeleted ? incoming : current }
    }
    // Genuine delete-vs-edit.
    if (isTimeEntry) {
      // Never silently erase edited minutes — surface it, keep the live row.
      return {
        outcome: 'surfaced',
        merged: incDeleted ? current : incoming,
        surfaced: { fields: ['deletedAt'], incoming },
      }
    }
    return { outcome: 'merged', merged: prefersIncoming(current, incoming) ? incoming : current }
  }

  // Neither deleted → three-way field merge.
  const names = new Set([
    ...Object.keys(base.fields),
    ...Object.keys(current.fields),
    ...Object.keys(incoming.fields),
  ])
  const merged: Record<string, SyncValue> = {}
  const surfacedFields: string[] = []

  for (const name of names) {
    const b = base.fields[name] ?? null
    const cur = current.fields[name] ?? null
    const inc = incoming.fields[name] ?? null
    const curChanged = !eq(cur, b)
    const incChanged = !eq(inc, b)

    if (!incChanged) {
      merged[name] = cur // incoming left it alone → keep server's value
    } else if (!curChanged) {
      merged[name] = inc // only incoming changed it → take it
    } else if (eq(cur, inc)) {
      merged[name] = cur // both changed to the same value → agree
    } else if (isTimeEntry && INTERVAL_FIELDS.includes(name)) {
      surfacedFields.push(name) // interval collision → surface, keep server's interval
      merged[name] = cur
    } else {
      merged[name] = prefersIncoming(current, incoming) ? inc : cur // last-writer-wins
    }
  }

  const winner = prefersIncoming(current, incoming) ? incoming : current
  const mergedState = withFields(winner, merged)
  if (surfacedFields.length > 0) {
    return {
      outcome: 'surfaced',
      merged: mergedState,
      surfaced: { fields: surfacedFields, incoming },
    }
  }
  return { outcome: 'merged', merged: mergedState }
}
