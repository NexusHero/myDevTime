// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { LoginScreen } from './LoginScreen.js'
import { Button, Input } from '../components/index.js'
import type { AuthProviders, Credentials } from '../api/auth.js'

/**
 * The login form gates sign-in on `validateCredentials`: an invalid pair shows a
 * message and never calls `onSignIn`, a valid pair calls it with the entered
 * credentials. This pins the wiring between the form and the auth seam. Social /
 * forgot / register wiring is exercised elsewhere; here we drive the email flow.
 */
const NO_SOCIAL: AuthProviders = { emailPassword: true, social: [] }

function setup(): { renderer: TestRenderer.ReactTestRenderer; calls: Credentials[] } {
  const calls: Credentials[] = []
  const onSignIn = (c: Credentials): Promise<void> => {
    calls.push(c)
    return Promise.resolve()
  }
  let renderer!: TestRenderer.ReactTestRenderer
  act(() => {
    renderer = TestRenderer.create(
      <ThemeProvider>
        <LoginScreen
          onSignIn={onSignIn}
          onSocial={() => undefined}
          onForgot={() => Promise.resolve()}
          onGoRegister={() => undefined}
          providers={NO_SOCIAL}
        />
      </ThemeProvider>,
    )
  })
  return { renderer, calls }
}

/** The email/password submit button (social buttons share the same component). */
function signInButton(renderer: TestRenderer.ReactTestRenderer): TestRenderer.ReactTestInstance {
  return renderer.root.findAllByType(Button).find(b => b.props.children === 'Sign in')!
}

describe('LoginScreen', () => {
  it('EmptySubmit_ShowsValidationErrorAndDoesNotSignIn', async () => {
    const { renderer, calls } = setup()
    await act(async () => {
      signInButton(renderer).props.onPress()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(calls).toHaveLength(0)
    expect(JSON.stringify(renderer.toJSON())).toMatch(/valid email/i)
  })

  it('ValidCredentials_CallSignIn', async () => {
    const { renderer, calls } = setup()
    const inputs = renderer.root.findAllByType(Input)
    act(() => {
      inputs[0]!.props.onChangeText('dev@nexushero.io')
      inputs[1]!.props.onChangeText('longenough')
    })
    await act(async () => {
      signInButton(renderer).props.onPress()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(calls).toEqual([{ email: 'dev@nexushero.io', password: 'longenough' }])
  })
})
