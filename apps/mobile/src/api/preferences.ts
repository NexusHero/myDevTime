import { getJson, putJson } from './http.js'
import { record } from './parse.js'

/**
 * The preferences client (M10): the Settings screen's on/off toggles, persisted
 * per user + workspace by the `preferences` module. GET reads the merged values,
 * PUT sends only what changed and returns the full merged result. Booleans only —
 * a missing/legacy key falls back to the client default here, mirroring the server.
 */
export interface Preferences {
  readonly reminders: boolean
  readonly idleDetection: boolean
  readonly weekStartMonday: boolean
  readonly meetingConsent: boolean
  readonly breakReminders: boolean
  readonly calendarSync: boolean
  readonly autoTracker: boolean
  /** First-run onboarding completed (REQ-044) — app state, durable + cross-device, not a Settings toggle. */
  readonly onboarded: boolean
}

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
  const o = record(value)
  const out = { ...DEFAULT_PREFERENCES } as Record<PreferenceKey, boolean>
  for (const key of Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[]) {
    if (typeof o[key] === 'boolean') out[key] = o[key]
  }
  return out
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
