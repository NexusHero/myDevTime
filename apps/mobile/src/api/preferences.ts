import { getJson, putJson } from './http.js'
import { z } from 'zod'

/**
 * The preferences client (M10, extended for Sevi in ADR-0071): the Settings
 * screen's on/off toggles plus the quiet-hours minutes, persisted per user +
 * workspace by the `preferences` module. GET reads the merged values, PUT sends
 * only what changed and returns the full merged result. A missing/legacy/
 * malformed key falls back to the client default here, mirroring the server.
 */
export const preferencesSchema = z.object({
  reminders: z.boolean().catch(true).default(true),
  idleDetection: z.boolean().catch(true).default(true),
  weekStartMonday: z.boolean().catch(true).default(true),
  meetingConsent: z.boolean().catch(false).default(false),
  breakReminders: z.boolean().catch(true).default(true),
  calendarSync: z.boolean().catch(false).default(false),
  autoTracker: z.boolean().catch(false).default(false),
  onboarded: z.boolean().catch(false).default(false),
  seviProactive: z.boolean().catch(false).default(false),
  moodConsent: z.boolean().catch(false).default(false),
  quietStartMin: z.number().catch(1320).default(1320),
  quietEndMin: z.number().catch(420).default(420),
})
export type Preferences = z.infer<typeof preferencesSchema>

export const DEFAULT_PREFERENCES: Preferences = {
  reminders: true,
  idleDetection: true,
  weekStartMonday: true,
  meetingConsent: false,
  breakReminders: true,
  calendarSync: false,
  autoTracker: false,
  onboarded: false,
  seviProactive: false,
  moodConsent: false,
  quietStartMin: 1320, // 22:00, mirroring the server default
  quietEndMin: 420, // 07:00
}

export type PreferenceKey = keyof Preferences
/** The on/off toggle keys — what `usePreferences().setPref` may flip. */
export type BooleanPreferenceKey = {
  [K in PreferenceKey]: Preferences[K] extends boolean ? K : never
}[PreferenceKey]
/** The minute-of-day keys — what `usePreferences().setNumberPref` may set. */
export type NumberPreferenceKey = Exclude<PreferenceKey, BooleanPreferenceKey>

/** Parse a preferences DTO, filling any missing/malformed key from the defaults. */
export function parsePreferences(value: unknown): Preferences {
  const result = preferencesSchema.safeParse(value)
  return result.success ? result.data : DEFAULT_PREFERENCES
}

/** Read the caller's stored preferences (merged onto defaults). */
export async function getPreferences(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Preferences> {
  return parsePreferences(await getJson(baseUrl, '/api/preferences', fetchImpl))
}

/** Persist a patch (only the changed keys); returns the full merged preferences. */
export async function updatePreferences(
  baseUrl: string,
  patch: Partial<Preferences>,
  fetchImpl: typeof fetch = fetch,
): Promise<Preferences> {
  return parsePreferences(await putJson(baseUrl, '/api/preferences', patch, fetchImpl))
}
