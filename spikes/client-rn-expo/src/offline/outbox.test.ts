import { describe, expect, it } from 'vitest'
import { ack, enqueue, toPush, type OutboxEntry } from './outbox.js'

/**
 * Q2 evidence: local offline edits map cleanly onto the sync engine's push shape,
 * coalesce per entity, carry LWW metadata, and clear on ack.
 */
const DEVICE = 'device-A'

describe('offline outbox → sync push', () => {
  it('Enqueue_StampsLwwMetadataForTheSyncEngine', () => {
    const box = enqueue([], { type: 'timeEntry', id: 't1', fields: { note: 'draft' }, at: 100 }, DEVICE, 1)
    const push = toPush(box)
    expect(push).toHaveLength(1)
    expect(push[0]).toMatchObject({
      type: 'timeEntry',
      id: 't1',
      deviceId: DEVICE,
      updatedAt: 100,
      deletedAt: null,
      fields: { note: 'draft' },
    })
  })

  it('Enqueue_CoalescesRepeatedOfflineEditsToOneRow', () => {
    let box: OutboxEntry[] = []
    box = enqueue(box, { type: 'timeEntry', id: 't1', fields: { note: 'a' }, at: 100 }, DEVICE, 1)
    box = enqueue(box, { type: 'timeEntry', id: 't1', fields: { billable: true }, at: 200 }, DEVICE, 2)
    const push = toPush(box)
    expect(push).toHaveLength(1) // one snapshot, not a replay log
    expect(push[0]!.updatedAt).toBe(200) // newest wins
    expect(push[0]!.fields).toEqual({ note: 'a', billable: true }) // fields merged
  })

  it('Enqueue_PreservesPerEntityOrderAcrossEntities', () => {
    let box: OutboxEntry[] = []
    box = enqueue(box, { type: 'project', id: 'p1', fields: { name: 'X' }, at: 100 }, DEVICE, 1)
    box = enqueue(box, { type: 'timeEntry', id: 't1', fields: { note: 'a' }, at: 110 }, DEVICE, 2)
    box = enqueue(box, { type: 'project', id: 'p1', fields: { color: 'red' }, at: 120 }, DEVICE, 3)
    expect(toPush(box).map(e => e.id)).toEqual(['p1', 't1']) // p1 keeps its original slot
  })

  it('Enqueue_TombstoneSyncsLikeAnyChange', () => {
    const box = enqueue([], { type: 'task', id: 'k1', fields: {}, deletedAt: 500, at: 500 }, DEVICE, 1)
    expect(toPush(box)[0]!.deletedAt).toBe(500)
  })

  it('Ack_DropsFlushedEntriesKeepsNewer', () => {
    let box: OutboxEntry[] = []
    box = enqueue(box, { type: 'project', id: 'p1', fields: { name: 'X' }, at: 100 }, DEVICE, 1)
    box = enqueue(box, { type: 'project', id: 'p2', fields: { name: 'Y' }, at: 200 }, DEVICE, 2)
    box = ack(box, 1)
    expect(box.map(e => e.id)).toEqual(['p2'])
  })
})
