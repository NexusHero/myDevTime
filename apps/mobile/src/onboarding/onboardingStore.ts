/**
 * First-run gate persistence (design v3 onboarding). We have no app-wide storage
 * primitive yet (theme pref is in-memory; user preferences persist server-side via
 * the preferences API), so this is a tiny cross-platform seam: on web
 * (react-native-web, the current render target) it uses `localStorage`; on native
 * it falls back to an in-memory flag until a durable store (AsyncStorage / a
 * server-side "onboarded" flag) is wired. One key, read/written through here only.
 */
const KEY = 'mydevtime.onboarded'

/** Best-effort `localStorage`, or null when it is unavailable (native / SSR). */
function web(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

let memoryFlag = false

export function hasOnboarded(): boolean {
  const store = web()
  if (store) return store.getItem(KEY) === '1'
  return memoryFlag
}

export function markOnboarded(): void {
  const store = web()
  if (store) {
    store.setItem(KEY, '1')
    return
  }
  memoryFlag = true
}
