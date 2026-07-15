// @vitest-environment jsdom
// The flow renders react-native-web TextInputs, which need a DOM.
import { afterEach, describe, expect, it } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { Text as RNText } from 'react-native'
import { OnboardingGate } from './OnboardingGate.js'
import { ThemeProvider } from '../theme/ThemeProvider.js'

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

function render(): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer
  act(() => {
    tree = TestRenderer.create(
      <ThemeProvider>
        <OnboardingGate>
          <RNText>WORKSPACE</RNText>
        </OnboardingGate>
      </ThemeProvider>,
    )
  })
  return tree
}

describe('OnboardingGate (first-run)', () => {
  it('shows the welcome flow, not the workspace, on a fresh device', () => {
    const json = JSON.stringify(render().toJSON())
    expect(json).toContain('Get started')
    expect(json).not.toContain('WORKSPACE')
  })

  it('skips straight to the workspace once onboarding is marked done', () => {
    localStorage.setItem('mydevtime.onboarded', '1')
    const json = JSON.stringify(render().toJSON())
    expect(json).toContain('WORKSPACE')
    expect(json).not.toContain('Get started')
  })
})
