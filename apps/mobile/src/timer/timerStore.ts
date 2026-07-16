import type { StartTimerInput } from '../api/timer.js'
import type { PersistedTimerSession } from './reconcile.js'

/**
 * Local persistence for the timer's client-only session state (REQ-004) — the banked
 * total and paused context that the server does not model — so a running or paused
 * timer survives an app restart. Same cross-platform seam as `onboardingStore`: on
 * web (react-native-web, the current render target) it uses `localStorage`, which
 * persists across a reload; on native it falls back to an in-memory value until a
 * durable native store (AsyncStorage) is wired. One key, read/written through here.
 */
const KEY = 'mydevtime.timer.session'

/** Best-effort `localStorage`, or null when it is unavailable (native / SSR). */
function web(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

let memory: string | null = null

/** Load the persisted session, or null when nothing valid is stored. */
export function loadTimerSession(): PersistedTimerSession | null {
  const store = web()
  const raw = store ? store.getItem(KEY) : memory
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const rec = parsed as Record<string, unknown>
    const accumulatedMs =
      typeof rec.accumulatedMs === 'number' && Number.isFinite(rec.accumulatedMs)
        ? rec.accumulatedMs
        : 0
    const pausedInput =
      typeof rec.pausedInput === 'object' && rec.pausedInput !== null
        ? (rec.pausedInput as StartTimerInput)
        : null
    const pausedSinceMs =
      typeof rec.pausedSinceMs === 'number' && Number.isFinite(rec.pausedSinceMs)
        ? rec.pausedSinceMs
        : null
    return { accumulatedMs, pausedInput, pausedSinceMs }
  } catch {
    return null
  }
}

/** Persist the session, or clear it when `session` is null (idle / punched out). */
export function saveTimerSession(session: PersistedTimerSession | null): void {
  const store = web()
  if (session === null) {
    if (store) store.removeItem(KEY)
    else memory = null
    return
  }
  const raw = JSON.stringify(session)
  if (store) store.setItem(KEY, raw)
  else memory = raw
}
