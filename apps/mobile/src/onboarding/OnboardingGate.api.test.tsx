// @vitest-environment jsdom
// The onboarding flow renders react-native-web TextInputs, which need a DOM.
import { afterEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { Text as RNText } from 'react-native'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { ensureLocalStorage } from '../test/localStorage.js'

/**
 * The durable, cross-device onboarding gate (REQ-044, audit M11): when an API is
 * configured, the gate reconciles against the server `onboarded` preference rather
 * than an in-memory native flag that reset every cold start. These pin that the
 * server flag decides — onboarded → straight to the workspace, not → the flow.
 */
ensureLocalStorage()

vi.mock('../config', async importOriginal => ({
  ...(await importOriginal<typeof import('../config')>()),
  apiBaseUrl: 'https://api.test',
}))

const getPreferences = vi.fn((..._args: unknown[]): unknown => undefined)
const updatePreferences = vi.fn((..._args: unknown[]): Promise<void> => Promise.resolve())
vi.mock('../api/preferences', () => ({
  getPreferences: (...args: unknown[]) => getPreferences(...args),
  updatePreferences: (...args: unknown[]) => updatePreferences(...args),
}))

const { OnboardingGate } = await import('./OnboardingGate.js')

afterEach(() => {
  localStorage.clear()
  getPreferences.mockReset()
})

async function render(): Promise<TestRenderer.ReactTestRenderer> {
  let tree!: TestRenderer.ReactTestRenderer
  await act(async () => {
    tree = TestRenderer.create(
      <ThemeProvider>
        <OnboardingGate>
          <RNText>WORKSPACE</RNText>
        </OnboardingGate>
      </ThemeProvider>,
    )
  })
  await act(async () => {
    await Promise.resolve()
  })
  return tree
}

describe('OnboardingGate — durable server flag (REQ-044)', () => {
  it('ServerSaysOnboarded_SkipsStraightToTheWorkspace', async () => {
    getPreferences.mockResolvedValue({ onboarded: true })

    const json = JSON.stringify((await render()).toJSON())

    expect(json).toContain('WORKSPACE')
    expect(json).not.toContain('Get started')
  })

  it('ServerSaysNotOnboarded_ShowsTheFlow', async () => {
    getPreferences.mockResolvedValue({ onboarded: false })

    const json = JSON.stringify((await render()).toJSON())

    expect(json).toContain('Get started')
    expect(json).not.toContain('WORKSPACE')
  })
})
