import { getJson, putJson } from './http.js'
import { z } from 'zod'

/**
 * The preferences client (M10): the Settings screen's on/off toggles, persisted
 * per user + workspace by the `preferences` module. GET reads the merged values,
 * PUT sends only what changed and returns the full merged result. Booleans only —
 * a missing/legacy key falls back to the client default here, mirroring the server.
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
}

export type PreferenceKey = keyof Preferences

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
