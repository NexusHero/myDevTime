import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES, mergePreferences } from './preferences.js'
import { UpdatePreferencesDto } from './preferences.dto.js'

/**
 * Preference merge (M10, extended for Sevi in ADR-0071): a stored blob or a client
 * patch is layered onto the defaults; only known boolean keys — plus the two known
 * quiet-hours minute keys, clamped to integral 0..1439 — are taken, so a missing/
 * legacy/garbage field can never crash the read or smuggle in an unknown setting.
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

  it('SeviAndMoodConsent_DefaultOff_AndApplyAsBooleans', () => {
    // Proactivity and mood memory are opt-IN by construction (ADR-0071 P2/P3).
    expect(DEFAULT_PREFERENCES.seviProactive).toBe(false)
    expect(DEFAULT_PREFERENCES.moodConsent).toBe(false)
    const out = mergePreferences(DEFAULT_PREFERENCES, { seviProactive: true, moodConsent: true })
    expect(out.seviProactive).toBe(true)
    expect(out.moodConsent).toBe(true)
  })

  it('QuietMinutes_ApplyAsIntegersWithinTheDay', () => {
    const out = mergePreferences(DEFAULT_PREFERENCES, { quietStartMin: 1260, quietEndMin: 360 })
    expect(out.quietStartMin).toBe(1260)
    expect(out.quietEndMin).toBe(360)
  })

  it('QuietMinutes_ClampOutOfRangeAndTruncateFractions', () => {
    const out = mergePreferences(DEFAULT_PREFERENCES, {
      quietStartMin: 5000,
      quietEndMin: -3,
    })
    expect(out.quietStartMin).toBe(1439) // clamped to the last minute of the day
    expect(out.quietEndMin).toBe(0) // clamped to midnight
    expect(mergePreferences(DEFAULT_PREFERENCES, { quietStartMin: 90.7 }).quietStartMin).toBe(90)
  })

  it('QuietMinutes_RejectNonNumbersKeepingTheBase', () => {
    const out = mergePreferences(DEFAULT_PREFERENCES, {
      quietStartMin: '22:00',
      quietEndMin: Number.NaN,
    })
    expect(out.quietStartMin).toBe(DEFAULT_PREFERENCES.quietStartMin)
    expect(out.quietEndMin).toBe(DEFAULT_PREFERENCES.quietEndMin)
  })
})

/**
 * The patch DTO must accept the new Sevi fields within honest bounds (0..1439 whole
 * minutes) and reject anything outside — the merge clamps stored blobs, but a live
 * client patch should fail loudly instead of being silently bent.
 */
describe('UpdatePreferencesDto', () => {
  const schema = UpdatePreferencesDto.schema

  it('AcceptsTheSeviFieldsWithinBounds', () => {
    const parsed = schema.safeParse({
      seviProactive: true,
      moodConsent: true,
      quietStartMin: 1320,
      quietEndMin: 420,
    })
    expect(parsed.success).toBe(true)
  })

  it('RejectsAQuietMinuteOutsideTheDay', () => {
    expect(schema.safeParse({ quietStartMin: 1440 }).success).toBe(false)
    expect(schema.safeParse({ quietEndMin: -1 }).success).toBe(false)
  })

  it('RejectsAFractionalQuietMinute', () => {
    expect(schema.safeParse({ quietStartMin: 90.5 }).success).toBe(false)
  })
})
