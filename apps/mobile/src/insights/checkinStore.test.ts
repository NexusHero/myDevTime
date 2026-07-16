// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { loadCheckin, saveCheckin } from './checkinStore.js'

afterEach(() => {
  localStorage.clear()
})

/**
 * The check-in store keeps a single most-recent local record and validates on load,
 * so corrupt or out-of-range data never reaches the UI. It is local-only by contract
 * (never uploaded) — these tests pin the round-trip and the guards.
 */
describe('checkinStore', () => {
  it('SaveThenLoad_RoundTripsTheWeeklyCheckin', () => {
    saveCheckin({ week: '2026-07-13', exhaustion: 3, detachment: 2 })
    expect(loadCheckin()).toEqual({ week: '2026-07-13', exhaustion: 3, detachment: 2 })
  })

  it('NothingStored_IsNull', () => {
    expect(loadCheckin()).toBeNull()
  })

  it('LatestSaveWins', () => {
    saveCheckin({ week: '2026-07-06', exhaustion: 5, detachment: 5 })
    saveCheckin({ week: '2026-07-13', exhaustion: 1, detachment: 1 })
    expect(loadCheckin()?.week).toBe('2026-07-13')
  })

  it('OutOfRangeScale_IsRejected', () => {
    localStorage.setItem(
      'mydevtime.checkin',
      JSON.stringify({ week: '2026-07-13', exhaustion: 9, detachment: 2 }),
    )
    expect(loadCheckin()).toBeNull()
  })

  it('CorruptJson_IsNull', () => {
    localStorage.setItem('mydevtime.checkin', '{not json')
    expect(loadCheckin()).toBeNull()
  })
})
