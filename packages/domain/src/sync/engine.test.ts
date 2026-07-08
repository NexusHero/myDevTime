import { describe, expect, it } from 'vitest'
import { applyPush, emptyServer, entityKey, pull, type PushChange } from './engine.js'
import type { EntityState, SyncEntityType, SyncValue } from './types.js'

/**
 * The sync engine's apply/pull mechanics (REQ-006, ADR-0019): inserts,
 * idempotent re-delivery, version-bump-only-on-change, conflict surfacing,
 * tombstones, and watermark-based pull. Convergence over interleavings is in
 * simulation.test.ts.
 */

function entity(
  over: Partial<EntityState> & { type?: SyncEntityType; fields?: Record<string, SyncValue> } = {},
): EntityState {
  return {
    type: over.type ?? 'timeEntry',
    id: over.id ?? 'e1',
    deletedAt: over.deletedAt ?? null,
    updatedAt: over.updatedAt ?? 1000,
    deviceId: over.deviceId ?? 'devA',
    fields: over.fields ?? { note: 'a' },
  }
}

function change(over: Partial<PushChange> & { incoming: EntityState }): PushChange {
  return { opId: over.opId ?? 'op1', base: over.base ?? null, incoming: over.incoming }
}

describe('applyPush', () => {
  it('ApplyPush_NewEntity_InsertsWithVersion1', () => {
    const { server, results } = applyPush(emptyServer(), [change({ incoming: entity() })])
    expect(results[0]?.outcome).toBe('applied')
    expect(results[0]?.version).toBe(1)
    expect(server.records.get(entityKey('timeEntry', 'e1'))?.state.fields.note).toBe('a')
  })

  it('ApplyPush_ReplayedOpId_IsIdempotentNoOp', () => {
    const first = applyPush(emptyServer(), [change({ opId: 'op1', incoming: entity() })])
    const replay = applyPush(first.server, [
      change({ opId: 'op1', incoming: entity({ fields: { note: 'DIFFERENT' } }) }),
    ])
    expect(replay.results[0]?.outcome).toBe('skipped')
    // The replay did not overwrite with the (ignored) different payload.
    expect(replay.server.records.get(entityKey('timeEntry', 'e1'))?.state.fields.note).toBe('a')
    expect(replay.server.seq).toBe(first.server.seq)
  })

  it('ApplyPush_StaleNoOpEdit_DoesNotBumpVersion', () => {
    const base = entity({ fields: { note: 'a' } })
    const seeded = applyPush(emptyServer(), [change({ opId: 'seed', incoming: base })])
    // A second op that resolves to the same content must not advance the cursor.
    const again = applyPush(seeded.server, [
      change({ opId: 'op2', base, incoming: entity({ fields: { note: 'a' }, updatedAt: 5000 }) }),
    ])
    expect(again.results[0]?.outcome).toBe('skipped')
    expect(again.server.seq).toBe(seeded.server.seq)
  })

  it('ApplyPush_ConflictingInterval_SurfacesWithVersionBump', () => {
    const base = entity({ fields: { startedAt: 100, endedAt: 200 } })
    const seeded = applyPush(emptyServer(), [change({ opId: 'seed', incoming: base })])
    // Server already moved the end; client pushes a different end from the old base.
    const serverEdit = applyPush(seeded.server, [
      change({
        opId: 'srv',
        base,
        incoming: entity({ fields: { startedAt: 100, endedAt: 250 }, updatedAt: 2000 }),
      }),
    ])
    const clientEdit = applyPush(serverEdit.server, [
      change({
        opId: 'cli',
        base,
        incoming: entity({ fields: { startedAt: 100, endedAt: 300 }, updatedAt: 3000 }),
      }),
    ])
    expect(clientEdit.results[0]?.outcome).toBe('surfaced')
    expect(clientEdit.results[0]?.conflict?.fields).toContain('endedAt')
    // Server interval is kept; the client's competing end is preserved for review.
    expect(clientEdit.server.records.get(entityKey('timeEntry', 'e1'))?.state.fields.endedAt).toBe(
      250,
    )
    expect(clientEdit.results[0]?.conflict?.incoming.fields.endedAt).toBe(300)
  })

  it('ApplyPush_Deletion_StoredAsTombstone', () => {
    const base = entity()
    const seeded = applyPush(emptyServer(), [change({ opId: 'seed', incoming: base })])
    const del = applyPush(seeded.server, [
      change({ opId: 'del', base, incoming: entity({ deletedAt: 9000, updatedAt: 9000 }) }),
    ])
    expect(del.server.records.get(entityKey('timeEntry', 'e1'))?.state.deletedAt).toBe(9000)
  })
})

describe('pull', () => {
  it('Pull_AboveWatermark_ReturnsOrderedTail', () => {
    let server = emptyServer()
    server = applyPush(server, [change({ opId: 'o1', incoming: entity({ id: 'a' }) })]).server
    server = applyPush(server, [change({ opId: 'o2', incoming: entity({ id: 'b' }) })]).server
    server = applyPush(server, [change({ opId: 'o3', incoming: entity({ id: 'c' }) })]).server

    const all = pull(server, 0)
    expect(all.changes.map(c => c.state.id)).toEqual(['a', 'b', 'c'])
    expect(all.watermark).toBe(3)

    const tail = pull(server, 2)
    expect(tail.changes.map(c => c.state.id)).toEqual(['c'])
    expect(tail.watermark).toBe(3)
  })

  it('Pull_NothingNewer_KeepsWatermark', () => {
    const server = applyPush(emptyServer(), [change({ incoming: entity() })]).server
    expect(pull(server, 5).watermark).toBe(5)
    expect(pull(server, 5).changes).toHaveLength(0)
  })
})
