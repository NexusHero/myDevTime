import { describe, expect, it } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { Text } from 'react-native'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { AuthGate } from './AuthGate.js'

/**
 * In demo mode (no `EXPO_PUBLIC_API_URL`, the default under the test gate) the
 * session resolves a demo user, so the gate is transparent and renders the app —
 * a regression guard that auth never blocks the demo/offline experience.
 */
describe('AuthGate', () => {
  it('DemoMode_RendersChildrenOnceSessionResolves', async () => {
    let renderer!: TestRenderer.ReactTestRenderer
    await act(async () => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <AuthGate>
            <Text>APP-CONTENT</Text>
          </AuthGate>
        </ThemeProvider>,
      )
    })
    expect(JSON.stringify(renderer.toJSON())).toContain('APP-CONTENT')
  })
})
