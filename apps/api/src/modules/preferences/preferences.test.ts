import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES, mergePreferences } from './preferences.js'

/**
 * Preference merge (M10): a stored blob or a client patch is layered onto the
 * defaults; only known boolean keys are taken so a missing/legacy/garbage field
 * can never crash the read or smuggle in an unknown setting.
 */
describe('mergePreferences', () => {
  it('AppliesAKnownBooleanPatchOntoTheBase', () => {
    const out = mergePreferences(DEFAULT_PREFERENCES, { calendarSync: true, autoTracker: true })
    expect(out.calendarSync).toBe(true)
    expect(out.autoTracker).toBe(true)
    expect(out.reminders).toBe(true) // untouched key keeps the base value
  })

  it('IgnoresUnknownKeysAndNonBooleanValues', () => {
    const out = mergePreferences(DEFAULT_PREFERENCES, {
      calendarSync: 'yes',
      bogus: true,
      weekStartMonday: false,
    })
    expect(out.calendarSync).toBe(false) // non-boolean rejected → stays default
    expect(out.weekStartMonday).toBe(false) // valid boolean applied
    expect('bogus' in out).toBe(false)
  })

  it('ReturnsTheBaseUnchangedForNonObjectPatches', () => {
    expect(mergePreferences(DEFAULT_PREFERENCES, null)).toEqual(DEFAULT_PREFERENCES)
    expect(mergePreferences(DEFAULT_PREFERENCES, 'nope')).toEqual(DEFAULT_PREFERENCES)
  })

  it('HydratesAPartialStoredBlobOntoAllDefaults', () => {
    const out = mergePreferences(DEFAULT_PREFERENCES, { meetingConsent: true })
    expect(out.meetingConsent).toBe(true)
    expect(out).toMatchObject({ reminders: true, breakReminders: true })
  })
})
