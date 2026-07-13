// @vitest-environment jsdom
// The web path reads/writes `localStorage`, which needs a DOM.
import { afterEach, describe, expect, it } from 'vitest'
import { hasOnboarded, markOnboarded } from './onboardingStore.js'

const mockStore = new Map<string, string>()
global.localStorage = {
  clear: () => mockStore.clear(),
  getItem: (key: string) => mockStore.get(key) ?? null,
  setItem: (key: string, value: string) => mockStore.set(key, value),
} as unknown as Storage

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
