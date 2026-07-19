// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { ToastProvider } from '../components/core/Toast.js'
import { SessionProvider } from '../shell/SessionContext.js'
import { TestQueryProvider } from '../test/TestQueryProvider.js'
import { ApiError } from '../api/http.js'
import { Button, Row } from '../components/index.js'
import type { SessionResource } from '../hooks/useSession.js'
import type { ConnectorsResource } from '../hooks/useConnectors.js'
import type { CalendarImportPlan, ConnectorStatus } from '../api/connectors.js'
import { ProfileScreen } from './ProfileScreen.js'

/**
 * Profile reads the shared session and now wires the connector OAuth flow +
 * calendar-import preview (REQ-010, #15). The connectors hook is mocked (house
 * pattern — cf. TaskScreen) so the tests inject honest states and spies without a
 * network: **Connect** must trigger `authorize` and surface a 409 "not configured"
 * honestly (never a fake connect); the **calendar preview** renders the returned
 * proposals as ghost rows (writes nothing, ADR-0005); and a consent-gated preview
 * shows the backend's honest 409 reason.
 */
const connectorsHolder = vi.hoisted(() => ({
  value: null as unknown as ConnectorsResource,
}))

vi.mock('../hooks/useConnectors', () => ({
  useConnectors: () => connectorsHolder.value,
}))

function makeConnectors(overrides: Partial<ConnectorsResource> = {}): ConnectorsResource {
  return {
    connectors: [],
    live: true,
    loading: false,
    error: null,
    setConsent: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(() => Promise.resolve(null)),
    previewCalendar: vi.fn(() =>
      Promise.resolve<CalendarImportPlan>({
        proposal: { changes: [], orphaned: [], unchangedCount: 0 },
        status: 'ok',
      }),
    ),
    ...overrides,
  }
}

const GITLAB_CONFIGURED: ConnectorStatus = {
  id: 'gitlab',
  label: 'GitLab',
  category: 'git',
  configured: true,
  connected: false,
  capabilities: [],
}

function googleCalendar(inboundGranted: boolean): ConnectorStatus {
  return {
    id: 'google-calendar',
    label: 'Google Calendar',
    category: 'calendar',
    configured: true,
    connected: true,
    capabilities: [
      { capability: 'inbound', label: 'Read events', granted: inboundGranted },
      { capability: 'capture', label: 'Events as capture candidates', granted: false },
    ],
  }
}

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
          <ToastProvider>
            <SessionProvider value={session}>
              <ProfileScreen onNavigate={() => undefined} />
            </SessionProvider>
          </ToastProvider>
        </ThemeProvider>
      </TestQueryProvider>,
    )
  })
  return renderer
}

/** Let the fire-and-forget connect/preview promises settle, then re-render. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

function findButton(
  renderer: TestRenderer.ReactTestRenderer,
  label: string,
): TestRenderer.ReactTestInstance | undefined {
  return renderer.root
    .findAllByType(Button)
    .find(b => typeof b.props.children === 'string' && b.props.children.includes(label))
}

beforeEach(() => {
  connectorsHolder.value = makeConnectors()
})

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

  it('Connect_TriggersAuthorize_AndSurfaces409NotConfiguredHonestly', async () => {
    const connect = vi.fn(() =>
      Promise.reject(
        new ApiError(
          409,
          'Not configured',
          "'gitlab' is not configured in this deployment (client id/secret)",
        ),
      ),
    )
    connectorsHolder.value = makeConnectors({ connectors: [GITLAB_CONFIGURED], connect })
    const { session } = fakeSession()
    const renderer = render(session)

    const gitlabRow = renderer.root.findAllByType(Row).find(r => r.props.title === 'GitLab')
    await act(async () => {
      gitlabRow!.props.onPress()
    })
    await flush()

    expect(connect).toHaveBeenCalledWith('gitlab')
    const tree = JSON.stringify(renderer.toJSON())
    // The honest 409 reason is shown; the connector is NOT faked as connected.
    expect(tree).toContain('not configured in this deployment')
    expect(tree).toContain('Connect') // badge still reads "Connect", never "Connected"
    expect(tree).not.toContain('Connected')
  })

  it('CalendarPreview_RendersReturnedProposals', async () => {
    const previewCalendar = vi.fn(() =>
      Promise.resolve<CalendarImportPlan>({
        status: 'ok',
        proposal: {
          changes: [
            {
              kind: 'new',
              event: {
                uid: 'evt-1',
                startMs: Date.UTC(2026, 6, 20, 12, 0),
                endMs: Date.UTC(2026, 6, 20, 13, 0),
                title: 'Sprint Planning',
              },
            },
          ],
          orphaned: [],
          unchangedCount: 2,
        },
      }),
    )
    connectorsHolder.value = makeConnectors({
      connectors: [googleCalendar(true)],
      previewCalendar,
    })
    const { session } = fakeSession()
    const renderer = render(session)

    const previewBtn = findButton(renderer, 'Preview calendar import')
    expect(previewBtn).toBeDefined()
    await act(async () => {
      previewBtn!.props.onPress()
    })
    await flush()

    expect(previewCalendar).toHaveBeenCalled()
    const tree = JSON.stringify(renderer.toJSON())
    expect(tree).toContain('Sprint Planning') // proposal rendered as a ghost row
    expect(tree).toContain('nothing is booked') // labelled as proposals (ADR-0005)
    expect(findButton(renderer, 'Confirm import')).toBeDefined() // honest stub affordance
  })

  it('CalendarPreview_ConsentGated_ShowsHonestReason', async () => {
    const previewCalendar = vi.fn(() =>
      Promise.reject(
        new ApiError(
          409,
          'Consent required',
          "consent for 'inbound' has not been granted for google-calendar",
        ),
      ),
    )
    connectorsHolder.value = makeConnectors({
      connectors: [googleCalendar(false)],
      previewCalendar,
    })
    const { session } = fakeSession()
    const renderer = render(session)

    const previewBtn = findButton(renderer, 'Preview calendar import')
    await act(async () => {
      previewBtn!.props.onPress()
    })
    await flush()

    expect(previewCalendar).toHaveBeenCalled()
    const tree = JSON.stringify(renderer.toJSON())
    expect(tree).toContain("consent for 'inbound' has not been granted")
    expect(tree).not.toContain('Sprint Planning') // no proposals shown when gated
  })
})
