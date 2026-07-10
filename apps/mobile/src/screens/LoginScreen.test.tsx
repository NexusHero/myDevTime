// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { LoginScreen } from './LoginScreen.js'
import { Button, Input } from '../components/index.js'
import type { Credentials } from '../api/auth.js'

/**
 * The login form gates sign-in on `validateCredentials`: an invalid pair shows a
 * message and never calls `onSignIn`, a valid pair calls it with the entered
 * credentials. This pins the wiring between the form and the auth seam.
 */
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
        <LoginScreen onSignIn={onSignIn} />
      </ThemeProvider>,
    )
  })
  return { renderer, calls }
}

describe('LoginScreen', () => {
  it('EmptySubmit_ShowsValidationErrorAndDoesNotSignIn', () => {
    const { renderer, calls } = setup()
    act(() => {
      renderer.root.findByType(Button).props.onPress()
    })
    expect(calls).toHaveLength(0)
    expect(JSON.stringify(renderer.toJSON())).toMatch(/valid email/i)
  })

  it('ValidCredentials_CallSignIn', () => {
    const { renderer, calls } = setup()
    const inputs = renderer.root.findAllByType(Input)
    act(() => {
      inputs[0]!.props.onChangeText('dev@nexushero.io')
      inputs[1]!.props.onChangeText('longenough')
    })
    act(() => {
      renderer.root.findByType(Button).props.onPress()
    })
    expect(calls).toEqual([{ email: 'dev@nexushero.io', password: 'longenough' }])
  })
})
