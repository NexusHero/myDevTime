import { describe, expect, it } from 'vitest'
import { resolveCrudWrite, type CrudWrite, type ServerRow } from './crud.js'

const live = (version: number): ServerRow => ({ version, deleted: false })
const tombstone = (version: number): ServerRow => ({ version, deleted: true })

function write(partial: Partial<CrudWrite>): CrudWrite {
  return {
    type: 'timeEntry',
    op: 'patch',
    changed: {},
    baseVersion: 1,
    ...partial,
  }
}

describe('resolveCrudWrite', () => {
  it('Put_OfANewId_Applies', () => {
    expect(resolveCrudWrite(write({ op: 'put', baseVersion: null }), null)).toEqual({
      outcome: 'applied',
    })
  })

  it('Delete_OfAnAbsentOrAlreadyDeletedRow_IsNoop', () => {
    expect(resolveCrudWrite(write({ op: 'delete', changed: {} }), null).outcome).toBe('noop')
    expect(resolveCrudWrite(write({ op: 'delete', changed: {} }), tombstone(5)).outcome).toBe(
      'noop',
    )
  })

  it('Delete_OfATimeEntryEditedElsewhere_IsSurfaced', () => {
    // base v1, server now v2 → the entry moved since our base → delete-vs-edit.
    const d = resolveCrudWrite(write({ op: 'delete', changed: {}, baseVersion: 1 }), live(2))
    expect(d.outcome).toBe('surfaced')
    expect(d.fields).toEqual(['deletedAt'])
  })

  it('Delete_OfACatalogRowEditedElsewhere_AppliesLWW', () => {
    const d = resolveCrudWrite(
      write({ type: 'project', op: 'delete', changed: {}, baseVersion: 1 }),
      live(2),
    )
    expect(d.outcome).toBe('applied')
  })

  it('Delete_WithNoConcurrentChange_Applies', () => {
    const d = resolveCrudWrite(write({ op: 'delete', changed: {}, baseVersion: 2 }), live(2))
    expect(d.outcome).toBe('applied')
  })

  it('Patch_WithNoConcurrentServerChange_Applies', () => {
    const d = resolveCrudWrite(
      write({ op: 'patch', changed: { startedAt: 111 }, baseVersion: 3 }),
      live(3),
    )
    expect(d.outcome).toBe('applied') // base == current → nobody else moved it
  })

  it('Patch_TimeEntryInterval_WithConcurrentChange_IsSurfaced', () => {
    const d = resolveCrudWrite(
      write({ op: 'patch', changed: { startedAt: 111, note: 'x' }, baseVersion: 1 }),
      live(2),
    )
    expect(d.outcome).toBe('surfaced')
    expect(d.fields).toEqual(['startedAt'])
  })

  it('Patch_TimeEntryNonInterval_WithConcurrentChange_AppliesLWW', () => {
    const d = resolveCrudWrite(
      write({ op: 'patch', changed: { note: 'only the note' }, baseVersion: 1 }),
      live(2),
    )
    expect(d.outcome).toBe('applied') // note is not an interval field
  })

  it('Patch_CatalogField_WithConcurrentChange_AppliesLWW', () => {
    const d = resolveCrudWrite(
      write({ type: 'project', op: 'patch', changed: { name: 'Renamed' }, baseVersion: 1 }),
      live(2),
    )
    expect(d.outcome).toBe('applied')
  })

  it('Patch_TimeEntryAgainstServerTombstone_IsSurfaced', () => {
    const d = resolveCrudWrite(
      write({ op: 'patch', changed: { note: 'still editing' }, baseVersion: 1 }),
      tombstone(2),
    )
    expect(d.outcome).toBe('surfaced')
    expect(d.fields).toEqual(['deletedAt'])
  })

  it('Patch_CatalogAgainstServerTombstone_Applies', () => {
    const d = resolveCrudWrite(
      write({ type: 'client', op: 'patch', changed: { name: 'Resurrected' }, baseVersion: 1 }),
      tombstone(2),
    )
    expect(d.outcome).toBe('applied')
  })

  it('Patch_BothInterval_ButEndedAtOnly_SurfacesEndedAt', () => {
    const d = resolveCrudWrite(
      write({ op: 'patch', changed: { endedAt: 999 }, baseVersion: 1 }),
      live(4),
    )
    expect(d.outcome).toBe('surfaced')
    expect(d.fields).toEqual(['endedAt'])
  })
})
