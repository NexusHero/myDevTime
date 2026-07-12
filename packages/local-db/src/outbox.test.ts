import { describe, expect, it } from 'vitest'
import type { EntityState } from '@mydevtime/domain'
import { openTestDb } from './testing/node-sqlite.js'
import { acknowledgeOps, enqueueOp, listPendingOps } from './outbox.js'

const WS = 'ws-1'
const OTHER = 'ws-2'

function state(id: string, fields: Record<string, string | number | boolean | null>): EntityState {
  return { type: 'timeEntry', id, deletedAt: null, updatedAt: 1000, deviceId: 'dev-1', fields }
}

describe('sync outbox', () => {
  it('EnqueueInsert_RoundTrips_WithNullBase', async () => {
    const db = await openTestDb()
    const op = await enqueueOp(db, WS, {
      entityType: 'timeEntry',
      entityId: 'e1',
      incoming: state('e1', { billable: true }),
    })
    expect(op.base).toBeNull()
    expect(op.baseVersion).toBeNull()
    const [stored] = await listPendingOps(db, WS)
    expect(stored?.opId).toBe(op.opId)
    expect(stored?.incoming.fields.billable).toBe(true)
    expect(stored?.base).toBeNull()
  })

  it('EnqueueEdit_PreservesBaseSnapshotAndVersion', async () => {
    const db = await openTestDb()
    await enqueueOp(db, WS, {
      entityType: 'project',
      entityId: 'p1',
      baseVersion: 7,
      base: state('p1', { name: 'Old' }),
      incoming: state('p1', { name: 'New' }),
    })
    const [stored] = await listPendingOps(db, WS)
    expect(stored?.baseVersion).toBe(7)
    expect(stored?.base?.fields.name).toBe('Old')
    expect(stored?.incoming.fields.name).toBe('New')
  })

  it('ListPendingOps_ReturnsOldestFirst', async () => {
    const db = await openTestDb()
    await enqueueOp(db, WS, {
      entityType: 'task',
      entityId: 't1',
      opId: 'a',
      incoming: state('t1', {}),
    })
    await enqueueOp(db, WS, {
      entityType: 'task',
      entityId: 't2',
      opId: 'b',
      incoming: state('t2', {}),
    })
    const ops = await listPendingOps(db, WS)
    expect(ops.map(o => o.opId)).toEqual(['a', 'b'])
  })

  it('AcknowledgeOps_RemovesThem_AndIsIdempotent', async () => {
    const db = await openTestDb()
    await enqueueOp(db, WS, {
      entityType: 'task',
      entityId: 't1',
      opId: 'a',
      incoming: state('t1', {}),
    })
    await enqueueOp(db, WS, {
      entityType: 'task',
      entityId: 't2',
      opId: 'b',
      incoming: state('t2', {}),
    })
    await acknowledgeOps(db, WS, ['a'])
    expect((await listPendingOps(db, WS)).map(o => o.opId)).toEqual(['b'])
    // Re-acking a already-removed op is a no-op.
    await acknowledgeOps(db, WS, ['a'])
    expect((await listPendingOps(db, WS)).map(o => o.opId)).toEqual(['b'])
  })

  it('Outbox_IsWorkspaceIsolated', async () => {
    const db = await openTestDb()
    await enqueueOp(db, WS, { entityType: 'task', entityId: 't1', incoming: state('t1', {}) })
    expect(await listPendingOps(db, OTHER)).toHaveLength(0)
    // Acking from the wrong workspace does not touch WS's op.
    const [op] = await listPendingOps(db, WS)
    await acknowledgeOps(db, OTHER, [op?.opId ?? ''])
    expect(await listPendingOps(db, WS)).toHaveLength(1)
  })
})
