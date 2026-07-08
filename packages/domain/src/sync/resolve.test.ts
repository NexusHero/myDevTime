import { describe, expect, it } from 'vitest'
import { resolve } from './resolve.js'
import type { EntityState, SyncEntityType, SyncValue } from './types.js'

/**
 * The deterministic conflict resolver (REQ-006, ADR-0019). Exhaustive per-branch
 * coverage: delete-vs-delete, delete-vs-edit (catalog LWW vs time-entry surface),
 * and the three-way field merge (non-overlapping merge, agreement, catalog LWW,
 * time-entry interval surface). Naming: Subject_StateUnderTest_ExpectedBehaviour.
 */

function state(
  over: Partial<EntityState> & { type?: SyncEntityType; fields?: Record<string, SyncValue> } = {},
): EntityState {
  return {
    type: over.type ?? 'timeEntry',
    id: over.id ?? 'e1',
    deletedAt: over.deletedAt ?? null,
    updatedAt: over.updatedAt ?? 1000,
    deviceId: over.deviceId ?? 'devA',
    fields: over.fields ?? {},
  }
}

describe('resolve', () => {
  it('Resolve_MismatchedIds_Throws', () => {
    expect(() => resolve(state({ id: 'a' }), state({ id: 'a' }), state({ id: 'b' }))).toThrow(
      /different entities/,
    )
  })

  it('Resolve_MismatchedTypes_Throws', () => {
    expect(() =>
      resolve(state({ type: 'task' }), state({ type: 'task' }), state({ type: 'tag' })),
    ).toThrow(/mismatched entity types/)
  })

  // ── Deletion ───────────────────────────────────────────────────────────────

  it('Resolve_BothDeleted_KeepsLaterTombstone', () => {
    const base = state({ fields: { note: 'x' } })
    const current = state({ deletedAt: 2000, updatedAt: 2000, deviceId: 'devA' })
    const incoming = state({ deletedAt: 3000, updatedAt: 3000, deviceId: 'devB' })
    const r = resolve(base, current, incoming)
    expect(r.outcome).toBe('merged')
    expect(r.merged.deletedAt).toBe(3000)
  })

  it('Resolve_BothDeletedCurrentLater_KeepsCurrentTombstone', () => {
    const base = state({ fields: { note: 'x' } })
    const current = state({ deletedAt: 4000, updatedAt: 4000, deviceId: 'devB' })
    const incoming = state({ deletedAt: 3000, updatedAt: 3000, deviceId: 'devA' })
    const r = resolve(base, current, incoming)
    expect(r.merged.deletedAt).toBe(4000) // current is the later tombstone
  })

  it('Resolve_IncomingDeleteVsNoEdit_AppliesDeletionUncontested', () => {
    const base = state({ fields: { note: 'x' } })
    const current = state({ fields: { note: 'x' } }) // server never touched it
    const incoming = state({ deletedAt: 5000, updatedAt: 5000, fields: { note: 'x' } })
    const r = resolve(base, current, incoming)
    expect(r.outcome).toBe('merged')
    expect(r.merged.deletedAt).toBe(5000)
  })

  it('Resolve_ServerDeleteVsNoLocalEdit_AppliesDeletionUncontested', () => {
    const base = state({ fields: { note: 'x' } })
    const current = state({ deletedAt: 5000, updatedAt: 5000, fields: { note: 'x' } })
    const incoming = state({ fields: { note: 'x' } }) // client never touched it
    const r = resolve(base, current, incoming)
    expect(r.outcome).toBe('merged')
    expect(r.merged.deletedAt).toBe(5000) // keeps current's tombstone
  })

  it('Resolve_TimeEntryServerDeleteVsLocalEdit_SurfacesKeepingIncoming', () => {
    const base = state({ fields: { note: 'x', startedAt: 100 } })
    const current = state({
      deletedAt: 4000,
      updatedAt: 4000,
      fields: { note: 'x', startedAt: 100 },
    })
    const incoming = state({ fields: { note: 'edited', startedAt: 100 }, updatedAt: 5000 })
    const r = resolve(base, current, incoming)
    expect(r.outcome).toBe('surfaced')
    expect(r.merged.deletedAt).toBeNull() // the still-edited local row is kept live
    expect(r.merged.fields.note).toBe('edited')
  })

  it('Resolve_TimeEntryDeleteVsEdit_Surfaces', () => {
    const base = state({ fields: { note: 'x', startedAt: 100 } })
    // server edited the entry, client deleted it
    const current = state({ fields: { note: 'edited', startedAt: 100 }, updatedAt: 4000 })
    const incoming = state({
      deletedAt: 5000,
      updatedAt: 5000,
      fields: { note: 'x', startedAt: 100 },
    })
    const r = resolve(base, current, incoming)
    expect(r.outcome).toBe('surfaced')
    expect(r.surfaced?.fields).toContain('deletedAt')
    expect(r.merged.deletedAt).toBeNull() // the edited, live row is kept
    expect(r.merged.fields.note).toBe('edited')
  })

  it('Resolve_CatalogDeleteVsEdit_LastWriterWins', () => {
    const base = state({ type: 'project', fields: { name: 'Old' } })
    const current = state({ type: 'project', fields: { name: 'Renamed' }, updatedAt: 4000 })
    const incoming = state({
      type: 'project',
      deletedAt: 9000,
      updatedAt: 9000,
      fields: { name: 'Old' },
    })
    const r = resolve(base, current, incoming)
    expect(r.outcome).toBe('merged')
    expect(r.merged.deletedAt).toBe(9000) // delete is the later write → wins
  })

  it('Resolve_CatalogEditVsDelete_EditWinsWhenLater', () => {
    const base = state({ type: 'project', fields: { name: 'Old' } })
    const current = state({
      type: 'project',
      deletedAt: 3000,
      updatedAt: 3000,
      fields: { name: 'Old' },
    })
    const incoming = state({ type: 'project', fields: { name: 'Renamed' }, updatedAt: 8000 })
    const r = resolve(base, current, incoming)
    expect(r.outcome).toBe('merged')
    expect(r.merged.deletedAt).toBeNull()
    expect(r.merged.fields.name).toBe('Renamed')
  })

  // ── Three-way field merge ────────────────────────────────────────────────────

  it('Resolve_OnlyIncomingChangedField_TakesIncoming', () => {
    const base = state({ fields: { note: 'a', billable: true } })
    const current = state({ fields: { note: 'a', billable: true } })
    const incoming = state({ fields: { note: 'b', billable: true }, updatedAt: 2000 })
    const r = resolve(base, current, incoming)
    expect(r.outcome).toBe('merged')
    expect(r.merged.fields.note).toBe('b')
  })

  it('Resolve_OnlyCurrentChangedField_KeepsCurrent', () => {
    const base = state({ fields: { note: 'a' } })
    const current = state({ fields: { note: 'server' }, updatedAt: 2000 })
    const incoming = state({ fields: { note: 'a' } })
    const r = resolve(base, current, incoming)
    expect(r.merged.fields.note).toBe('server')
  })

  it('Resolve_BothChangedFieldToSameValue_Agrees', () => {
    const base = state({ fields: { note: 'a' } })
    const current = state({ fields: { note: 'same' }, updatedAt: 2000 })
    const incoming = state({ fields: { note: 'same' }, updatedAt: 3000 })
    const r = resolve(base, current, incoming)
    expect(r.outcome).toBe('merged')
    expect(r.merged.fields.note).toBe('same')
  })

  it('Resolve_TimeEntryNonIntervalCollision_MergesByLastWriter', () => {
    const base = state({ fields: { note: 'a', startedAt: 100, endedAt: 200 } })
    const current = state({
      fields: { note: 'server', startedAt: 100, endedAt: 200 },
      updatedAt: 2000,
    })
    const incoming = state({
      fields: { note: 'client', startedAt: 100, endedAt: 200 },
      updatedAt: 5000,
    })
    const r = resolve(base, current, incoming)
    expect(r.outcome).toBe('merged') // note collision is not surfaced
    expect(r.merged.fields.note).toBe('client') // later writer
  })

  it('Resolve_TimeEntryIntervalCollision_SurfacesAndKeepsServerInterval', () => {
    const base = state({ fields: { startedAt: 100, endedAt: 200, note: 'a' } })
    const current = state({ fields: { startedAt: 100, endedAt: 250, note: 'a' }, updatedAt: 2000 })
    const incoming = state({
      fields: { startedAt: 100, endedAt: 300, note: 'client' },
      updatedAt: 5000,
    })
    const r = resolve(base, current, incoming)
    expect(r.outcome).toBe('surfaced')
    expect(r.surfaced?.fields).toEqual(['endedAt'])
    expect(r.merged.fields.endedAt).toBe(250) // server interval kept, not the later client value
    expect(r.merged.fields.note).toBe('client') // non-interval field still merges
    expect(r.surfaced?.incoming.fields.endedAt).toBe(300)
  })

  it('Resolve_CatalogFieldCollisionCurrentLater_KeepsCurrent', () => {
    const base = state({ type: 'client', fields: { name: 'A' } })
    const current = state({ type: 'client', fields: { name: 'Server' }, updatedAt: 9000 })
    const incoming = state({ type: 'client', fields: { name: 'Client' }, updatedAt: 2000 })
    const r = resolve(base, current, incoming)
    expect(r.merged.fields.name).toBe('Server') // current is the later writer → wins
  })

  it('Resolve_IncomingAddsFieldAbsentInBase_TakesIt', () => {
    const base = state({ fields: { note: 'a' } })
    const current = state({ fields: { note: 'a' } })
    const incoming = state({ fields: { note: 'a', billable: false }, updatedAt: 2000 })
    const r = resolve(base, current, incoming)
    expect(r.merged.fields.billable).toBe(false) // new field on incoming is applied
  })

  it('Resolve_CatalogDeleteVsEditCurrentLater_CurrentEditWins', () => {
    const base = state({ type: 'task', fields: { name: 'Old' } })
    const current = state({ type: 'task', fields: { name: 'Renamed' }, updatedAt: 9000 })
    const incoming = state({
      type: 'task',
      deletedAt: 2000,
      updatedAt: 2000,
      fields: { name: 'Old' },
    })
    const r = resolve(base, current, incoming)
    expect(r.merged.deletedAt).toBeNull() // current's later edit beats the older delete
    expect(r.merged.fields.name).toBe('Renamed')
  })

  it('Resolve_CatalogFieldCollisionEqualTimestamps_BreaksTieByDeviceId', () => {
    const base = state({ type: 'tag', fields: { color: '#000' } })
    const current = state({
      type: 'tag',
      fields: { color: '#111' },
      updatedAt: 2000,
      deviceId: 'devA',
    })
    const incoming = state({
      type: 'tag',
      fields: { color: '#222' },
      updatedAt: 2000,
      deviceId: 'devB',
    })
    const r = resolve(base, current, incoming)
    expect(r.merged.fields.color).toBe('#222') // devB > devA wins the tie
  })

  it('Resolve_IncomingOmitsFieldPresentInBase_TreatsAsCleared', () => {
    const base = state({ fields: { note: 'a', billable: true } })
    const current = state({ fields: { note: 'a', billable: true } })
    const incoming = state({ fields: { note: 'a' }, updatedAt: 2000 }) // billable omitted → null
    const r = resolve(base, current, incoming)
    expect(r.merged.fields.billable).toBeNull()
  })

  it('Resolve_NoChanges_KeepsCurrent', () => {
    const base = state({ fields: { note: 'a' } })
    const current = state({ fields: { note: 'a' } })
    const incoming = state({ fields: { note: 'a' } })
    const r = resolve(base, current, incoming)
    expect(r.outcome).toBe('merged')
    expect(r.merged.fields.note).toBe('a')
  })
})
