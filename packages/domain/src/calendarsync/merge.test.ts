import { describe, expect, it } from 'vitest'
import { mergeCalendar, type ExternalEvent, type ImportedBlock } from './merge.js'

const H = 60 * 60 * 1000
const T0 = 1_700_000_000_000

const ev = (uid: string, startMs: number, endMs: number, title = uid): ExternalEvent => ({
  uid,
  startMs,
  endMs,
  title,
})
const block = (uid: string, startMs: number, endMs: number, title = uid): ImportedBlock => ({
  uid,
  startMs,
  endMs,
  title,
})

describe('mergeCalendar', () => {
  it('UnseenEvents_AreProposedAsNew', () => {
    const p = mergeCalendar([ev('a', T0, T0 + H)], [])
    expect(p.changes).toEqual([{ kind: 'new', event: ev('a', T0, T0 + H) }])
    expect(p.orphaned).toEqual([])
    expect(p.unchangedCount).toBe(0)
  })

  it('IdenticalEvents_AreUnchanged_NotReimported', () => {
    const p = mergeCalendar([ev('a', T0, T0 + H)], [block('a', T0, T0 + H)])
    expect(p.changes).toEqual([])
    expect(p.unchangedCount).toBe(1)
  })

  it('MovedOrRenamedEvents_AreProposedAsChanged', () => {
    const moved = ev('a', T0 + H, T0 + 2 * H)
    const renamed = ev('b', T0, T0 + H, 'New title')
    const p = mergeCalendar(
      [moved, renamed],
      [block('a', T0, T0 + H), block('b', T0, T0 + H, 'Old title')],
    )
    expect(p.changes).toEqual([
      { kind: 'changed', event: moved, from: block('a', T0, T0 + H) },
      { kind: 'changed', event: renamed, from: block('b', T0, T0 + H, 'Old title') },
    ])
    expect(p.unchangedCount).toBe(0)
  })

  it('VanishedEvents_AreProposedAsOrphaned', () => {
    const p = mergeCalendar([], [block('a', T0, T0 + H)])
    expect(p.orphaned).toEqual([block('a', T0, T0 + H)])
    expect(p.changes).toEqual([])
  })

  it('NeverWritesTwice_TheKeyIsTheUid', () => {
    // Re-running the same merge on the now-imported state proposes nothing new.
    const first = mergeCalendar([ev('a', T0, T0 + H)], [])
    expect(first.changes).toHaveLength(1)
    const applied = [block('a', T0, T0 + H)]
    const second = mergeCalendar([ev('a', T0, T0 + H)], applied)
    expect(second.changes).toEqual([])
    expect(second.orphaned).toEqual([])
  })

  it('DropsEmptyOrInvertedEvents', () => {
    const p = mergeCalendar([ev('a', T0, T0), ev('b', T0 + 2 * H, T0 + H)], [])
    expect(p.changes).toEqual([])
  })
})
