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
  /** Explicit opt-in to Sevi's *proactive* voice (ADR-0071 P2) — off until turned on. */
  readonly seviProactive: boolean
  /** Explicit opt-in to persisting the punch-out mood (ADR-0071 P3, REQ-068). */
  readonly moodConsent: boolean
  /** Quiet-hours window start, minute of day 0..1439; may wrap midnight (default 22:00). */
  readonly quietStartMin: number
  /** Quiet-hours window end, minute of day 0..1439 (default 07:00). */
  readonly quietEndMin: number
}

/** The boolean toggles the merge accepts. */
export const PREFERENCE_KEYS = [
  'reminders',
  'idleDetection',
  'weekStartMonday',
  'meetingConsent',
  'breakReminders',
  'calendarSync',
  'autoTracker',
  'onboarded',
  'seviProactive',
  'moodConsent',
] as const satisfies readonly (keyof Preferences)[]

/** The minute-of-day numbers the merge accepts (clamped to integral 0..1439). */
export const NUMBER_PREFERENCE_KEYS = [
  'quietStartMin',
  'quietEndMin',
] as const satisfies readonly (keyof Preferences)[]

/** The last valid minute of a day (23:59) — the clamp ceiling for quiet-hours values. */
export const LAST_MINUTE_OF_DAY = 1439

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
  quietStartMin: 1320, // 22:00
  quietEndMin: 420, // 07:00
}

/**
 * Merge a (possibly partial, possibly untrusted) patch onto a base: only the known
 * boolean keys with a boolean value and the known minute keys with a finite number
 * (truncated + clamped to 0..1439) are taken; everything else keeps the base. Used
 * both to apply a client patch and to hydrate a stored jsonb blob onto the
 * defaults, so a missing or malformed field can never crash the read.
 */
export function mergePreferences(base: Preferences, patch: unknown): Preferences {
  if (patch === null || typeof patch !== 'object') return base
  const rec = patch as Record<string, unknown>
  const out: { -readonly [K in keyof Preferences]: Preferences[K] } = { ...base }
  for (const key of PREFERENCE_KEYS) {
    const value = rec[key]
    if (typeof value === 'boolean') out[key] = value
  }
  for (const key of NUMBER_PREFERENCE_KEYS) {
    const value = rec[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = Math.min(LAST_MINUTE_OF_DAY, Math.max(0, Math.trunc(value)))
    }
  }
  return out
}
