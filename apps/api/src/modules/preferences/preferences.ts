/**
 * User preference toggles (M10): the small set of per-user, per-workspace on/off
 * settings the client's Settings screen owns — break reminders, calendar sync,
 * auto-tracker, idle detection, etc. These are UI/behaviour switches, not the
 * deterministic core's numbers, so they live in this module (not `packages/domain`),
 * but the shape and the merge are pure and tested so persistence stays honest:
 * a stored blob is merged onto the defaults, never trusted blindly.
 */
export interface Preferences {
  /** Send reminders/notifications. */
  readonly reminders: boolean
  /** Detect idle time and prompt to trim it (REQ-033). */
  readonly idleDetection: boolean
  /** Week starts on Monday (vs. Sunday). */
  readonly weekStartMonday: boolean
  /** Explicit opt-in to meeting capture/transcription (REQ-025). */
  readonly meetingConsent: boolean
  /** Prompt for breaks after a focus run. */
  readonly breakReminders: boolean
  /** Pull calendar events as capture candidates. */
  readonly calendarSync: boolean
  /** Auto-track app/editor usage into suggestions. */
  readonly autoTracker: boolean
  /**
   * First-run onboarding completed (REQ-044). App state, **not** a user-facing
   * toggle — it is not rendered in Settings. Persisting it here makes the
   * onboarding gate durable and cross-device instead of an in-memory native flag
   * that reset on every cold start (audit M11).
   */
  readonly onboarded: boolean
}

export const PREFERENCE_KEYS: readonly (keyof Preferences)[] = [
  'reminders',
  'idleDetection',
  'weekStartMonday',
  'meetingConsent',
  'breakReminders',
  'calendarSync',
  'autoTracker',
  'onboarded',
]

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

/**
 * Merge a (possibly partial, possibly untrusted) patch onto a base: only the known
 * keys with a boolean value are taken, everything else keeps the base. Used both to
 * apply a client patch and to hydrate a stored jsonb blob onto the defaults, so a
 * missing or malformed field can never crash the read.
 */
export function mergePreferences(base: Preferences, patch: unknown): Preferences {
  if (patch === null || typeof patch !== 'object') return base
  const rec = patch as Record<string, unknown>
  const out: Record<keyof Preferences, boolean> = { ...base }
  for (const key of PREFERENCE_KEYS) {
    const value = rec[key]
    if (typeof value === 'boolean') out[key] = value
  }
  return out
}
