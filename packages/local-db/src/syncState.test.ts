import { describe, expect, it } from 'vitest'
import { openTestDb } from './testing/node-sqlite.js'
import { getSyncState, setWatermark } from './syncState.js'

const WS = 'ws-1'
const OTHER = 'ws-2'

describe('sync state', () => {
  it('GetSyncState_CreatesRow_WithZeroWatermarkAndDeviceId', async () => {
    const db = await openTestDb()
    const state = await getSyncState(db, WS)
    expect(state.watermark).toBe(0)
    expect(state.deviceId).not.toBe('')
  })

  it('DeviceId_IsStable_AcrossReads', async () => {
    const db = await openTestDb()
    const first = await getSyncState(db, WS)
    const second = await getSyncState(db, WS)
    expect(second.deviceId).toBe(first.deviceId)
  })

  it('SetWatermark_Persists_AndResumesFromThere', async () => {
    const db = await openTestDb()
    const { deviceId } = await getSyncState(db, WS)
    await setWatermark(db, WS, 42)
    const state = await getSyncState(db, WS)
    expect(state.watermark).toBe(42)
    expect(state.deviceId).toBe(deviceId) // watermark update leaves the device id intact
  })

  it('SetWatermark_CreatesState_WhenMissing', async () => {
    const db = await openTestDb()
    await setWatermark(db, WS, 5)
    expect((await getSyncState(db, WS)).watermark).toBe(5)
  })

  it('SyncState_IsWorkspaceIsolated', async () => {
    const db = await openTestDb()
    await setWatermark(db, WS, 9)
    const other = await getSyncState(db, OTHER)
    expect(other.watermark).toBe(0)
  })
})
