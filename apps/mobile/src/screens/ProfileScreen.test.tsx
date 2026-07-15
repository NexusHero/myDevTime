import { describe, expect, it } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { SessionProvider } from '../shell/SessionContext.js'
import { TestQueryProvider } from '../test/TestQueryProvider.js'
import { ProfileScreen } from './ProfileScreen.js'
import { Row } from '../components/index.js'
import type { SessionResource } from '../hooks/useSession.js'

/**
 * Profile reads the shared session: it shows the signed-in identity (name,
 * email, derived initials) rather than a hardcoded user, and its Sign out row
 * ends the session through the same seam.
 */
function fakeSession(overrides: Partial<SessionResource> = {}): {
  session: SessionResource
  signOuts: () => number
} {
  let count = 0
  const session: SessionResource = {
    user: { id: 'u1', email: 'dev@nexushero.io', emailVerified: true, name: 'Suhay Sevinç' },
    loading: false,
    error: null,
    live: true,
    busy: false,
    providers: { emailPassword: true, social: [] },
    signIn: () => Promise.resolve(),
    signUp: () => Promise.resolve(true),
    startSocial: () => undefined,
    requestReset: () => Promise.resolve(),
    signOut: () => {
      count += 1
      return Promise.resolve()
    },
    ...overrides,
  }
  return { session, signOuts: () => count }
}

function render(session: SessionResource): TestRenderer.ReactTestRenderer {
  let renderer!: TestRenderer.ReactTestRenderer
  act(() => {
    renderer = TestRenderer.create(
      <TestQueryProvider>
        <ThemeProvider>
          <SessionProvider value={session}>
            <ProfileScreen onNavigate={() => undefined} />
          </SessionProvider>
        </ThemeProvider>
      </TestQueryProvider>,
    )
  })
  return renderer
}

describe('ProfileScreen', () => {
  it('ShowsTheSignedInIdentity', () => {
    const { session } = fakeSession()
    const tree = JSON.stringify(render(session).toJSON())
    expect(tree).toContain('Suhay Sevinç') // name
    expect(tree).toContain('dev@nexushero.io') // email
    expect(tree).toContain('SS') // derived initials
  })

  it('SignOutRow_EndsTheSession', () => {
    const { session, signOuts } = fakeSession()
    const renderer = render(session)
    const signOutRow = renderer.root.findAllByType(Row).find(r => r.props.title === 'Sign out')
    act(() => {
      signOutRow!.props.onPress()
    })
    expect(signOuts()).toBe(1)
  })
})
