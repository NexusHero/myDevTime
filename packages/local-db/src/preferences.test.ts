import { describe, expect, it } from 'vitest'
import { openTestDb } from './testing/node-sqlite.js'
import { getAllPreferences, setPreference } from './preferences.js'

const WS = 'ws-1'
const OTHER = 'ws-2'

describe('preferences repository', () => {
  it('SetPreference_Upserts_AndReadsBack', async () => {
    const db = await openTestDb()
    await setPreference(db, WS, 'autoTracker', '1')
    expect(await getAllPreferences(db, WS)).toEqual({ autoTracker: '1' })
    // Upsert overwrites rather than duplicating.
    await setPreference(db, WS, 'autoTracker', '0')
    expect(await getAllPreferences(db, WS)).toEqual({ autoTracker: '0' })
  })

  it('Preferences_AreWorkspaceIsolated', async () => {
    const db = await openTestDb()
    await setPreference(db, WS, 'calendarSync', '1')
    expect(await getAllPreferences(db, OTHER)).toEqual({})
    await setPreference(db, OTHER, 'calendarSync', '0')
    expect(await getAllPreferences(db, WS)).toEqual({ calendarSync: '1' })
    expect(await getAllPreferences(db, OTHER)).toEqual({ calendarSync: '0' })
  })
})
