// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { SessionProvider } from '../shell/SessionContext.js'
import { ToastProvider } from '../components/core/Toast.js'
import { TestQueryProvider } from '../test/TestQueryProvider.js'
import { Button, IconButton, Input, Switch } from '../components/index.js'
import type { SessionResource } from '../hooks/useSession.js'
import type { Share } from '../api/sharing.js'

/**
 * Settings wires two backend-complete surfaces (audit M-4): the GDPR data controls (REQ-020) and
 * partner-light Free/Busy sharing (§F6). The app fabricates nothing, so these tests inject the API
 * seams and pin the honest behaviour: export triggers the real call; account deletion NEVER fires
 * without the typed confirmation and the destructive prompt; the share list renders, create adds
 * one, and revoke is confirmed before the DELETE. A configured workspace is mocked via `config`.
 */
vi.mock('../config', () => ({ apiBaseUrl: 'https://api.test' }))

const mockRequestDataExport = vi.fn((_base: string) =>
  Promise.resolve({ exportedAt: 'x', user: {}, workspace: {}, data: {} }),
)
const mockDeleteAccount = vi.fn((_base: string, _input: { confirm: 'DELETE' }) => Promise.resolve())
const mockTriggerJsonDownload = vi.fn((_data: unknown, _name: string) => true)
vi.mock('../api/privacy.js', () => ({
  requestDataExport: mockRequestDataExport,
  deleteAccount: mockDeleteAccount,
  triggerJsonDownload: mockTriggerJsonDownload,
}))

const mockListShares = vi.fn<(base: string) => Promise<Share[]>>(() =>
  Promise.resolve([
    {
      id: 's1',
      token: 'tok-abcdef',
      label: 'Design partner',
      createdAt: '2026-07-10T09:00:00.000Z',
    },
  ]),
)
const mockCreateShare = vi.fn((_base: string, _input: { label?: string | null }) =>
  Promise.resolve<Share>({ id: 's2', token: 'tok-new', label: null, createdAt: 'now' }),
)
const mockRevokeShare = vi.fn((_base: string, _id: string) => Promise.resolve())
vi.mock('../api/sharing.js', () => ({
  listShares: mockListShares,
  createShare: mockCreateShare,
  revokeShare: mockRevokeShare,
  shareLinkUrl: (base: string, token: string) => `${base}/api/sharing/${token}/freebusy`,
}))

// ─── Sevi seams (ADR-0071, REQ-068/069) ─────────────────────────────────────────────────
// Preferences are mocked so the Sevi tests can pin the exact setPref/setNumberPref writes;
// the notification port and the mood API are mocked to observe their single call sites.
const seviSeams = vi.hoisted(() => ({
  prefs: {
    reminders: true,
    idleDetection: true,
    weekStartMonday: true,
    meetingConsent: false,
    breakReminders: true,
    calendarSync: false,
    autoTracker: false,
    onboarded: true,
    seviProactive: false,
    moodConsent: false,
    quietStartMin: 1320, // 22:00
    quietEndMin: 420, // 07:00
  },
  setPref: vi.fn(),
  setNumberPref: vi.fn(),
  requestPermission: vi.fn(() => Promise.resolve(true)),
  deleteMoodHistory: vi.fn(() => Promise.resolve()),
}))
vi.mock('../hooks/usePreferences.js', () => ({
  usePreferences: () => ({
    prefs: seviSeams.prefs,
    live: true,
    loading: false,
    error: null,
    setPref: seviSeams.setPref,
    setNumberPref: seviSeams.setNumberPref,
  }),
}))
vi.mock('../notifications/port.js', () => ({
  createNotificationPort: () => ({
    available: true,
    requestPermission: seviSeams.requestPermission,
    notify: () => Promise.resolve(),
  }),
}))
vi.mock('../api/mood.js', () => ({
  deleteMoodHistory: seviSeams.deleteMoodHistory,
}))

const { SettingsScreen } = await import('./SettingsScreen.js')

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

async function render(session: SessionResource): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer
  await act(async () => {
    renderer = TestRenderer.create(
      <TestQueryProvider>
        <ThemeProvider>
          <ToastProvider>
            <SessionProvider value={session}>
              <SettingsScreen onBack={() => undefined} />
            </SessionProvider>
          </ToastProvider>
        </ThemeProvider>
      </TestQueryProvider>,
    )
  })
  // Let the injected listShares resolve into the async seam.
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return renderer
}

const byLabel = (
  renderer: TestRenderer.ReactTestRenderer,
  label: string,
): TestRenderer.ReactTestInstance | undefined =>
  renderer.root.findAllByType(Button).find(b => b.props.children === label)

const inputByPlaceholder = (
  renderer: TestRenderer.ReactTestRenderer,
  placeholder: string,
): TestRenderer.ReactTestInstance | undefined =>
  renderer.root.findAllByType(Input).find(i => i.props.placeholder === placeholder)

const iconButtonByLabel = (
  renderer: TestRenderer.ReactTestRenderer,
  label: string,
): TestRenderer.ReactTestInstance | undefined =>
  renderer.root.findAllByType(IconButton).find(b => b.props.label === label)

describe('SettingsScreen — privacy & sharing', () => {
  beforeEach(() => {
    mockRequestDataExport.mockClear()
    mockDeleteAccount.mockClear()
    mockTriggerJsonDownload.mockClear()
    mockListShares.mockClear()
    mockCreateShare.mockClear()
    mockRevokeShare.mockClear()
    mockListShares.mockResolvedValue([
      {
        id: 's1',
        token: 'tok-abcdef',
        label: 'Design partner',
        createdAt: '2026-07-10T09:00:00.000Z',
      },
    ])
  })

  it('Export_TriggersTheApiCall', async () => {
    const { session } = fakeSession()
    const renderer = await render(session)
    await act(async () => {
      byLabel(renderer, 'Export')!.props.onPress()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(mockRequestDataExport).toHaveBeenCalledTimes(1)
    expect(mockRequestDataExport).toHaveBeenCalledWith('https://api.test')
  })

  it('DeleteAccount_RequiresTypedConfirmationBeforeFiring', async () => {
    const { session } = fakeSession()
    const renderer = await render(session)
    // Pressing delete without typing DELETE must never call the API.
    await act(async () => {
      byLabel(renderer, 'Delete account')!.props.onPress()
    })
    expect(mockDeleteAccount).not.toHaveBeenCalled()

    // Arm it by typing DELETE, accept the destructive prompt, then it fires with the literal.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    act(() => {
      inputByPlaceholder(renderer, 'Type DELETE to confirm')!.props.onChangeText('DELETE')
    })
    await act(async () => {
      byLabel(renderer, 'Delete account')!.props.onPress()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(mockDeleteAccount).toHaveBeenCalledTimes(1)
    expect(mockDeleteAccount).toHaveBeenCalledWith('https://api.test', { confirm: 'DELETE' })
    confirmSpy.mockRestore()
  })

  it('ShareList_Renders_AndCreateAddsOne', async () => {
    const { session } = fakeSession()
    const renderer = await render(session)
    const tree = JSON.stringify(renderer.toJSON())
    // The injected share renders with its label, the public link, and the busy-only framing.
    expect(tree).toContain('Design partner')
    expect(tree).toContain('https://api.test/api/sharing/tok-abcdef/freebusy')
    expect(tree).toContain('Busy times only')

    act(() => {
      inputByPlaceholder(renderer, 'e.g. Design partner')!.props.onChangeText('New partner')
    })
    await act(async () => {
      byLabel(renderer, 'Create share link')!.props.onPress()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(mockCreateShare).toHaveBeenCalledTimes(1)
    expect(mockCreateShare).toHaveBeenCalledWith('https://api.test', { label: 'New partner' })
  })

  it('Revoke_ConfirmsBeforeCallingDelete', async () => {
    const { session } = fakeSession()
    const renderer = await render(session)
    // Declined confirmation → no DELETE.
    const declineSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    act(() => {
      iconButtonByLabel(renderer, 'Revoke Design partner')!.props.onPress()
    })
    expect(mockRevokeShare).not.toHaveBeenCalled()
    declineSpy.mockRestore()

    // Accepted confirmation → DELETE with the share id.
    const acceptSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await act(async () => {
      iconButtonByLabel(renderer, 'Revoke Design partner')!.props.onPress()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(mockRevokeShare).toHaveBeenCalledTimes(1)
    expect(mockRevokeShare).toHaveBeenCalledWith('https://api.test', 's1')
    acceptSpy.mockRestore()
  })
})

const switchByLabel = (
  renderer: TestRenderer.ReactTestRenderer,
  label: string,
): TestRenderer.ReactTestInstance | undefined =>
  renderer.root.findAllByType(Switch).find(s => s.props.accessibilityLabel === label)

const inputByFieldLabel = (
  renderer: TestRenderer.ReactTestRenderer,
  label: string,
): TestRenderer.ReactTestInstance | undefined =>
  renderer.root.findAllByType(Input).find(i => i.props.label === label)

describe('SettingsScreen — Sevi (REQ-068/069)', () => {
  beforeEach(() => {
    seviSeams.setPref.mockClear()
    seviSeams.setNumberPref.mockClear()
    seviSeams.requestPermission.mockClear()
    seviSeams.deleteMoodHistory.mockClear()
  })

  it('ProactiveToggle_ReflectsPref_AndEnableAsksNotificationPermission', async () => {
    const { session } = fakeSession()
    const renderer = await render(session)
    const toggle = switchByLabel(renderer, 'Proactive Sevi')
    expect(toggle).toBeDefined()
    expect(toggle!.props.checked).toBe(false)
    await act(async () => {
      ;(toggle!.props.onChange as (v: boolean) => void)(true)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(seviSeams.setPref).toHaveBeenCalledWith('seviProactive', true)
    expect(seviSeams.requestPermission).toHaveBeenCalledTimes(1)
  })

  it('ProactiveToggle_Disable_NeverAsksForPermission', async () => {
    const { session } = fakeSession()
    const renderer = await render(session)
    await act(async () => {
      ;(switchByLabel(renderer, 'Proactive Sevi')!.props.onChange as (v: boolean) => void)(false)
    })
    expect(seviSeams.setPref).toHaveBeenCalledWith('seviProactive', false)
    expect(seviSeams.requestPermission).not.toHaveBeenCalled()
  })

  it('QuietHours_ShowStoredMinutesAsHHMM_AndCommitMinutesOfDay', async () => {
    const { session } = fakeSession()
    const renderer = await render(session)
    const start = inputByFieldLabel(renderer, 'Quiet from')
    const end = inputByFieldLabel(renderer, 'Quiet until')
    expect(start!.props.value).toBe('22:00')
    expect(end!.props.value).toBe('07:00')
    act(() => {
      ;(start!.props.onChangeText as (t: string) => void)('21:30')
    })
    act(() => {
      ;(end!.props.onChangeText as (t: string) => void)('06:15')
    })
    expect(seviSeams.setNumberPref).toHaveBeenCalledWith('quietStartMin', 1290)
    expect(seviSeams.setNumberPref).toHaveBeenCalledWith('quietEndMin', 375)
  })

  it('QuietHours_MalformedTime_IsNeverCommitted', async () => {
    const { session } = fakeSession()
    const renderer = await render(session)
    const start = inputByFieldLabel(renderer, 'Quiet from')
    act(() => {
      ;(start!.props.onChangeText as (t: string) => void)('25:99')
    })
    act(() => {
      ;(start!.props.onChangeText as (t: string) => void)('9x')
    })
    expect(seviSeams.setNumberPref).not.toHaveBeenCalled()
  })

  it('MoodConsentToggle_ReflectsPref_AndWritesThroughSetPref', async () => {
    const { session } = fakeSession()
    const renderer = await render(session)
    const toggle = switchByLabel(renderer, 'Mood memory')
    expect(toggle).toBeDefined()
    expect(toggle!.props.checked).toBe(false)
    act(() => {
      ;(toggle!.props.onChange as (v: boolean) => void)(true)
    })
    expect(seviSeams.setPref).toHaveBeenCalledWith('moodConsent', true)
  })

  it('DeleteMoodHistory_ConfirmsBeforeErasing', async () => {
    const { session } = fakeSession()
    const renderer = await render(session)
    // Declined confirmation → nothing is erased.
    const declineSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await act(async () => {
      byLabel(renderer, 'Delete mood history')!.props.onPress()
    })
    expect(seviSeams.deleteMoodHistory).not.toHaveBeenCalled()
    declineSpy.mockRestore()

    // Accepted confirmation → one DELETE against the workspace.
    const acceptSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await act(async () => {
      byLabel(renderer, 'Delete mood history')!.props.onPress()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(seviSeams.deleteMoodHistory).toHaveBeenCalledTimes(1)
    expect(seviSeams.deleteMoodHistory).toHaveBeenCalledWith('https://api.test')
    acceptSpy.mockRestore()
  })
})
