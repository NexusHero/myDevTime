// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { RegisterScreen } from './RegisterScreen.js'
import { Button, Input } from '../components/index.js'
import type { AuthProviders, SignUpInput } from '../api/auth.js'

/**
 * Register gates sign-up on `validateSignUp` (name + email + password), calls the
 * seam with the entered values, and — when the server requires email verification
 * (sign-up resolves `false`) — swaps to a calm "check your inbox" state instead of
 * entering the app.
 */
const NO_SOCIAL: AuthProviders = { emailPassword: true, social: [] }

function setup(signUpResult: boolean): {
  renderer: TestRenderer.ReactTestRenderer
  calls: SignUpInput[]
} {
  const calls: SignUpInput[] = []
  let renderer!: TestRenderer.ReactTestRenderer
  act(() => {
    renderer = TestRenderer.create(
      <ThemeProvider>
        <RegisterScreen
          onSignUp={i => {
            calls.push(i)
            return Promise.resolve(signUpResult)
          }}
          onSocial={() => undefined}
          onGoLogin={() => undefined}
          providers={NO_SOCIAL}
        />
      </ThemeProvider>,
    )
  })
  return { renderer, calls }
}

const createButton = (r: TestRenderer.ReactTestRenderer): TestRenderer.ReactTestInstance =>
  r.root.findAllByType(Button).find(b => b.props.children === 'Konto erstellen')!

function fill(r: TestRenderer.ReactTestRenderer): void {
  const inputs = r.root.findAllByType(Input)
  act(() => {
    inputs[0]!.props.onChangeText('Dev') // name
    inputs[1]!.props.onChangeText('dev@nexushero.io') // email
    inputs[2]!.props.onChangeText('longenough') // password
  })
}

describe('RegisterScreen', () => {
  it('EmptySubmit_ShowsValidationError_AndDoesNotSignUp', () => {
    const { renderer, calls } = setup(true)
    act(() => {
      createButton(renderer).props.onPress()
    })
    expect(calls).toHaveLength(0)
    expect(JSON.stringify(renderer.toJSON())).toMatch(/name/i)
  })

  it('ValidInput_CallsSignUp', () => {
    const { renderer, calls } = setup(true)
    fill(renderer)
    act(() => {
      createButton(renderer).props.onPress()
    })
    expect(calls).toEqual([{ name: 'Dev', email: 'dev@nexushero.io', password: 'longenough' }])
  })

  it('VerificationRequired_ShowsCheckYourInboxNotice', async () => {
    const { renderer } = setup(false) // server didn't establish a session → verify email
    fill(renderer)
    await act(async () => {
      createButton(renderer).props.onPress()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(JSON.stringify(renderer.toJSON())).toContain('Bestätigungs-E-Mail')
  })
})
