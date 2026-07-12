// Simple in-memory localStorage mock for tests that run in Node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem(key: string) {
      return store[key] || null
    },
    setItem(key: string, value: string) {
      store[key] = value.toString()
    },
    removeItem(key: string) {
      delete store[key]
    },
    clear() {
      store = {}
    },
  }
})()

vi.mock('expo-sqlite', () => {
  return {
    openDatabaseSync: () => ({
      execAsync: vi.fn(),
      runAsync: vi.fn(),
      getFirstAsync: vi.fn(),
      getAllAsync: vi.fn(),
    }),
  }
})

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})
