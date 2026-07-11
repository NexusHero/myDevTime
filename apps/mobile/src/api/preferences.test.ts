import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  parsePreferences,
  updatePreferences,
} from './preferences.js'

/**
 * The preferences client (M10): parse the merged DTO (filling any missing key from
 * the defaults) and PUT only the changed keys. These pin the parse and that update
 * hits the right path with the patch body.
 */
describe('parsePreferences', () => {
  it('FillsMissingOrMalformedKeysFromDefaults', () => {
    const p = parsePreferences({ calendarSync: true, weekStartMonday: 'x' })
    expect(p.calendarSync).toBe(true)
    expect(p.weekStartMonday).toBe(DEFAULT_PREFERENCES.weekStartMonday)
    expect(p.reminders).toBe(DEFAULT_PREFERENCES.reminders)
  })
})

describe('getPreferences / updatePreferences', () => {
  it('GetsFromThePreferencesRoute', async () => {
    const seen: string[] = []
    const fetchImpl = ((url: string) => {
      seen.push(url)
      return Promise.resolve(new Response(JSON.stringify(DEFAULT_PREFERENCES), { status: 200 }))
    }) as unknown as typeof fetch
    const p = await getPreferences('http://api', fetchImpl)
    expect(p).toEqual(DEFAULT_PREFERENCES)
    expect(seen[0]).toContain('/api/preferences')
  })

  it('PutsOnlyThePatchAndReturnsTheMergedResult', async () => {
    let method: string | undefined
    let body: unknown
    const fetchImpl = ((_url: string, init?: RequestInit) => {
      method = init?.method
      body = JSON.parse((init?.body as string | undefined) ?? '{}')
      return Promise.resolve(
        new Response(JSON.stringify({ ...DEFAULT_PREFERENCES, autoTracker: true }), {
          status: 200,
        }),
      )
    }) as unknown as typeof fetch
    const p = await updatePreferences('http://api', { autoTracker: true }, fetchImpl)
    expect(method).toBe('PUT')
    expect(body).toEqual({ autoTracker: true })
    expect(p.autoTracker).toBe(true)
  })
})
