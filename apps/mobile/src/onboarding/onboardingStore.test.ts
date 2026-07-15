// @vitest-environment jsdom
// The web path reads/writes `localStorage`, which needs a DOM.
import { afterEach, describe, expect, it } from 'vitest'
import { hasOnboarded, markOnboarded } from './onboardingStore.js'

// Mock localStorage if jsdom's is blocked or undefined in the current environment
if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>()
  const mockStorage = {
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

afterEach(() => {
  localStorage.clear()
})

describe('onboardingStore (first-run gate)', () => {
  it('reports not-onboarded until marked', () => {
    expect(hasOnboarded()).toBe(false)
    markOnboarded()
    expect(hasOnboarded()).toBe(true)
  })

  it('persists the flag under a single namespaced key', () => {
    markOnboarded()
    expect(localStorage.getItem('mydevtime.onboarded')).toBe('1')
  })

  it('a fresh device (cleared storage) starts un-onboarded again', () => {
    markOnboarded()
    localStorage.clear()
    expect(hasOnboarded()).toBe(false)
  })
})
