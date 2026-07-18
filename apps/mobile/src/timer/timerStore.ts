import type { StartTimerInput } from '../api/timer.js'
import type { PersistedTimerSession } from './reconcile.js'
import { resolveKvStorage, type KvStorage } from './kvStorage.js'

/**
 * Local persistence for the timer's client-only session state (REQ-004) — the banked
 * total and paused context that the server does not model — so a running or paused
 * timer survives an app restart. Storage goes through the `KvStorage` seam
 * (`kvStorage.ts`): `localStorage` on web, AsyncStorage on native, in-memory as the
 * explicit last resort. Because the native store is async while the hook reads
 * synchronously, this module hydrates once at startup (`timerSessionReady`) into an
 * in-memory cache: `loadTimerSession` reads the cache synchronously, and
 * `saveTimerSession` updates the cache synchronously then writes through to the
 * backing store fire-and-forget. One key, read/written through here.
 */
const KEY = 'mydevtime.timer.session'

let storage: KvStorage = resolveKvStorage()
let cache: string | null = null
let ready: Promise<void> = hydrate(storage)

async function hydrate(from: KvStorage): Promise<void> {
  try {
    cache = await from.get(KEY)
  } catch {
    cache = null
  }
}

/**
 * Resolves once the persisted session has been read into the cache (hydrate-on-
 * start). On web this settles in a microtask; on native it is an AsyncStorage read
 * that in practice completes well before the `getRunning` network round-trip that
 * precedes the first `loadTimerSession` call in `useTimer`.
 */
export function timerSessionReady(): Promise<void> {
  return ready
}

/**
 * Swap the backing store and re-hydrate the cache from it — the seam for tests
 * (inject a fake `KvStorage`) and for platform bootstrap code. Resolves when the
 * cache reflects the new store.
 */
export function initTimerStore(next: KvStorage = resolveKvStorage()): Promise<void> {
  storage = next
  cache = null
  ready = hydrate(next)
  return ready
}

/** Load the persisted session, or null when nothing valid is stored. */
export function loadTimerSession(): PersistedTimerSession | null {
  const raw = cache
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
  if (session === null) {
    cache = null
    void storage.remove(KEY).catch(() => undefined)
    return
  }
  const raw = JSON.stringify(session)
  cache = raw
  void storage.set(KEY, raw).catch(() => undefined)
}
