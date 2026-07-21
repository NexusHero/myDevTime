// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'

/**
 * Render tests (ADR-0027) for the calm life-care card (ADR-0071 P5, REQ-071): each voice kind
 * renders its one line (as an accessible `status` row) with ONE explicit confirm; a confirm
 * posts exactly one protect-time proposal; no suggestions — including the gated-out case —
 * renders nothing at all. The hook is mocked: its derivation/gating has its own suite
 * (`useLifeCare.test.tsx`); here only the card's contract is under test.
 */

vi.mock('../../config', () => ({ apiBaseUrl: 'https://api.test' }))

const applyPlanProposal = vi.fn()
vi.mock('../../api/planApply.js', () => ({
  applyPlanProposal: (...args: unknown[]) => applyPlanProposal(...args) as unknown,
}))

interface MockVoice {
  kind: string
  message: string
  confirmLabel: string
  proposal: { kind: 'protect-time'; day: string; startMin: number; endMin: number }
}
const hookState: { suggestions: MockVoice[]; digestPending: boolean } = {
  suggestions: [],
  digestPending: false,
}
vi.mock('../../hooks/useLifeCare.js', () => ({
  useLifeCare: () => hookState,
}))

// Imported after the mocks so the card picks up the mocked hook + seam.
const { LifeCareCard } = await import('./LifeCareCard.js')
const { ThemeProvider } = await import('../../theme/ThemeProvider.js')

const WEEK = ['2026-07-13', '2026-07-14', '2026-07-15']

const EVENING_VOICE: MockVoice = {
  kind: 'no-free-evening',
  message: 'This week has no free evening yet.',
  confirmLabel: 'Protect an evening?',
  proposal: { kind: 'protect-time', day: '2026-07-15', startMin: 1080, endMin: 1320 },
}
const ENCROACH_VOICE: MockVoice = {
  kind: 'life-encroachment',
  message: 'Work overlaps "Yoga".',
  confirmLabel: 'Protect this time',
  proposal: { kind: 'protect-time', day: '2026-07-16', startMin: 1140, endMin: 1200 },
}
const REST_VOICE: MockVoice = {
  kind: 'rest-day',
  message: 'Several full days in a row — tomorrow evening could stay free.',
  confirmLabel: 'Keep tomorrow evening free',
  proposal: { kind: 'protect-time', day: '2026-07-16', startMin: 1080, endMin: 1320 },
}

function render(): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <LifeCareCard weekDates={WEEK} />
      </ThemeProvider>,
    )
  })
  return r
}

function texts(r: TestRenderer.ReactTestRenderer): string {
  return r.root
    .findAll(n => typeof n.type === 'string')
    .flatMap(n => n.children)
    .filter((c): c is string => typeof c === 'string')
    .join(' ')
}

function instanceText(node: TestRenderer.ReactTestInstance): string {
  return node
    .findAll(n => typeof n.type === 'string')
    .flatMap(n => n.children)
    .filter((c): c is string => typeof c === 'string')
    .join(' ')
}

async function pressText(r: TestRenderer.ReactTestRenderer, label: string): Promise<void> {
  const p = r.root.findAllByType(Pressable).find(x => instanceText(x).includes(label))
  expect(p, `pressable "${label}"`).toBeDefined()
  await act(async () => {
    ;(p!.props as { onPress: () => void }).onPress()
    await Promise.resolve()
  })
}

beforeEach(() => {
  hookState.suggestions = []
  hookState.digestPending = false
  applyPlanProposal.mockResolvedValue({
    proposal: { kind: 'protect-time', day: '2026-07-15', startMin: 1080, endMin: 1320 },
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('LifeCareCard', () => {
  it('LifeCareCard_NoFreeEveningVoice_RendersLineAndConfirmAppliesTheProposal', async () => {
    hookState.suggestions = [EVENING_VOICE]
    const r = render()
    expect(texts(r)).toContain('This week has no free evening yet.')
    // The status row carries the message as its accessible name (E2E locators rely on it).
    const row = r.root.findAll(
      n => typeof n.type === 'string' && (n.props as { role?: string }).role === 'status',
    )
    expect(row.length).toBe(1)
    // react-native-web lowers `accessibilityLabel` to `aria-label` on the host — the very
    // attribute Playwright's `getByRole('status', { name })` resolves against.
    const props = row[0]?.props as { 'aria-label'?: string; accessibilityLabel?: string }
    expect(props['aria-label'] ?? props.accessibilityLabel).toBe(EVENING_VOICE.message)
    await pressText(r, 'Protect an evening?')
    expect(applyPlanProposal).toHaveBeenCalledExactlyOnceWith(
      'https://api.test',
      EVENING_VOICE.proposal,
    )
    // The confirm collapses into a calm done-line — no second confirm to double-post.
    expect(texts(r)).toContain('Protected.')
  })

  it('LifeCareCard_EncroachmentVoice_NamesTheClashAndProtectsTheLifeWindow', async () => {
    hookState.suggestions = [ENCROACH_VOICE]
    const r = render()
    expect(texts(r)).toContain('Work overlaps "Yoga".')
    await pressText(r, 'Protect this time')
    expect(applyPlanProposal).toHaveBeenCalledExactlyOnceWith(
      'https://api.test',
      ENCROACH_VOICE.proposal,
    )
  })

  it('LifeCareCard_RestDayVoice_IsAProposalOnlyUntilTheExplicitConfirm', async () => {
    hookState.suggestions = [REST_VOICE]
    const r = render()
    expect(texts(r)).toContain('tomorrow evening could stay free')
    // Nothing auto-applies: rendering alone must not post.
    expect(applyPlanProposal).not.toHaveBeenCalled()
    await pressText(r, 'Keep tomorrow evening free')
    expect(applyPlanProposal).toHaveBeenCalledExactlyOnceWith(
      'https://api.test',
      REST_VOICE.proposal,
    )
  })

  it('LifeCareCard_NoSuggestions_RendersNothing', () => {
    const r = render()
    expect(r.toJSON()).toBeNull()
  })

  it('LifeCareCard_GatedOutByThePolicy_RendersNothing', () => {
    // Opt-out / quiet hours / 🛡 / cap all reach the card the same way: an empty delivery
    // (here with a held digest pending) — the card stays silent, no teaser, no badge.
    hookState.digestPending = true
    const r = render()
    expect(r.toJSON()).toBeNull()
  })
})
