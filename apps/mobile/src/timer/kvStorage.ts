/**
 * Cross-platform key-value persistence seam (REQ-004, on-device checklist C1/C2).
 * One narrow, string-valued interface — `get` / `set` / `remove` — with a resolver
 * that picks the most durable store the platform offers:
 *
 * 1. **Web** (react-native-web / browser): `localStorage`, wrapped async-shaped.
 * 2. **Native**: `@react-native-async-storage/async-storage`, loaded through a
 *    guarded `require` so the app still boots if the module (or its native side)
 *    cannot load.
 * 3. **Last resort**: an in-memory `Map` — the previous silent native behaviour,
 *    now an explicit, visible fallback that does not survive a restart.
 *
 * The interface is async because AsyncStorage is; the sync backends resolve
 * immediately. Vendor types stay confined to this file (ports & adapters,
 * SKILL §2.2) — callers only ever see `KvStorage`.
 */

export interface KvStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

/** `localStorage`-backed store (web), async-shaped to match the seam. */
export function webKvStorage(store: Storage): KvStorage {
  return {
    get: key => Promise.resolve(store.getItem(key)),
    set: (key, value) => {
      store.setItem(key, value)
      return Promise.resolve()
    },
    remove: key => {
      store.removeItem(key)
      return Promise.resolve()
    },
  }
}

/** In-memory store — nothing survives a restart; the explicit last-resort fallback. */
export function memoryKvStorage(): KvStorage {
  const map = new Map<string, string>()
  return {
    get: key => Promise.resolve(map.get(key) ?? null),
    set: (key, value) => {
      map.set(key, value)
      return Promise.resolve()
    },
    remove: key => {
      map.delete(key)
      return Promise.resolve()
    },
  }
}

/** The slice of AsyncStorage's API this seam consumes — vendor types go no further. */
export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

/** Adapt an AsyncStorage-shaped module to the seam. */
export function asyncKvStorage(store: AsyncStorageLike): KvStorage {
  return {
    get: key => store.getItem(key),
    set: (key, value) => store.setItem(key, value),
    remove: key => store.removeItem(key),
  }
}

/** Best-effort `localStorage`, or null when it is unavailable (native / SSR). */
function webStore(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/**
 * Load AsyncStorage at runtime, or null when unavailable. A guarded `require`
 * (not a static import) is deliberate: on web the module is never even loaded,
 * and if the package or its native module is missing the seam degrades to
 * in-memory instead of crashing the bundle at startup.
 */
function nativeStore(): KvStorage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native dependency, loaded lazily so web bundles never touch it; failure falls through to the in-memory fallback
    const mod: unknown = require('@react-native-async-storage/async-storage')
    const candidate: unknown = (mod as { default?: unknown }).default ?? mod
    const store = candidate as Partial<AsyncStorageLike>
    return typeof store.getItem === 'function' &&
      typeof store.setItem === 'function' &&
      typeof store.removeItem === 'function'
      ? asyncKvStorage(store as AsyncStorageLike)
      : null
  } catch {
    return null
  }
}

/**
 * Resolve the platform's durable store: web `localStorage` first, then native
 * AsyncStorage, then in-memory. The parameters exist for tests — production
 * callers use the defaults.
 */
export function resolveKvStorage(
  webStoreFn: () => Storage | null = webStore,
  nativeStoreFn: () => KvStorage | null = nativeStore,
): KvStorage {
  const web = webStoreFn()
  if (web !== null) return webKvStorage(web)
  return nativeStoreFn() ?? memoryKvStorage()
}
