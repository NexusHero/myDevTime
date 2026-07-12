import { describe, expect, it } from 'vitest'
import { openTestDb } from './testing/node-sqlite.js'
import {
  deleteEntry,
  getRunningEntry,
  listEntriesInRange,
  startEntry,
  stopRunningEntry,
} from './entries.js'

const WS = 'ws-1'
const OTHER = 'ws-2'

describe('entries repository', () => {
  it('StartEntry_RoundTrips_AsRunningEntry', async () => {
    const db = await openTestDb()
    const started = await startEntry(db, WS, { projectId: 'p1', note: 'hi' })
    expect(started.endedAt).toBeNull()
    const running = await getRunningEntry(db, WS)
    expect(running?.id).toBe(started.id)
    expect(running?.projectId).toBe('p1')
    expect(running?.note).toBe('hi')
    expect(running?.billable).toBe(true)
  })

  it('StartEntry_StopsThePreviousRunningTimer', async () => {
    const db = await openTestDb()
    const first = await startEntry(db, WS)
    const second = await startEntry(db, WS)
    const running = await getRunningEntry(db, WS)
    expect(running?.id).toBe(second.id)
    // Only one running row survives the partial unique index.
    const from = '2000-01-01T00:00:00.000Z'
    const to = '2999-01-01T00:00:00.000Z'
    const all = await listEntriesInRange(db, WS, from, to)
    const stillRunning = all.filter(e => e.endedAt === null)
    expect(stillRunning).toHaveLength(1)
    expect(stillRunning[0]?.id).toBe(second.id)
    expect(first.id).not.toBe(second.id)
  })

  it('StopRunningEntry_SetsEndedAt_AndClearsRunning', async () => {
    const db = await openTestDb()
    await startEntry(db, WS)
    const stopped = await stopRunningEntry(db, WS)
    expect(stopped?.endedAt).not.toBeNull()
    expect(await getRunningEntry(db, WS)).toBeNull()
  })

  it('DeleteEntry_Tombstones_SoItLeavesQueries', async () => {
    const db = await openTestDb()
    const e = await startEntry(db, WS)
    await stopRunningEntry(db, WS)
    await deleteEntry(db, WS, e.id)
    const all = await listEntriesInRange(
      db,
      WS,
      '2000-01-01T00:00:00.000Z',
      '2999-01-01T00:00:00.000Z',
    )
    expect(all).toHaveLength(0)
  })

  it('Entries_AreWorkspaceIsolated', async () => {
    const db = await openTestDb()
    await startEntry(db, WS, { note: 'mine' })
    // A different workspace sees nothing of ws-1's data.
    expect(await getRunningEntry(db, OTHER)).toBeNull()
    const otherRange = await listEntriesInRange(
      db,
      OTHER,
      '2000-01-01T00:00:00.000Z',
      '2999-01-01T00:00:00.000Z',
    )
    expect(otherRange).toHaveLength(0)
    // And starting a timer in ws-2 does not touch ws-1's running timer.
    await startEntry(db, OTHER, { note: 'theirs' })
    expect((await getRunningEntry(db, WS))?.note).toBe('mine')
    expect((await getRunningEntry(db, OTHER))?.note).toBe('theirs')
  })
})
