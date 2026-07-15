/**
 * Ensures a `localStorage` implementation exists for tests that exercise the web
 * persistence path. jsdom usually provides one, but some sandboxes block it or run
 * the module before jsdom installs it — this installs a minimal in-memory Storage
 * shim only when the global is missing, so real jsdom storage is never shadowed.
 */
export function ensureLocalStorage(): void {
  if (typeof localStorage !== 'undefined') return

  const store = new Map<string, string>()
  const mockStorage: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
  })
}
