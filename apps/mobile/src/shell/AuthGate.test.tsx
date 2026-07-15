// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { Text } from 'react-native'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { AuthGate } from './AuthGate.js'

/**
 * With no `EXPO_PUBLIC_API_URL` (the default under the test gate) there is no
 * backend and therefore no session, so the gate shows the Login screen rather than
 * fabricating a demo user — a regression guard that production without a signed-in
 * user never leaks into the app, and that the gate no longer auto-logs-in.
 */
describe('AuthGate', () => {
  it('NoBackend_ShowsTheLoginGate_NotTheApp', async () => {
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
    // Flush the session probe (resolves to null with no backend) + the re-render.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const tree = JSON.stringify(renderer.toJSON())
    expect(tree).toContain('Welcome back') // the login gate
    expect(tree).not.toContain('APP-CONTENT') // the app stays behind the gate
  })
})
