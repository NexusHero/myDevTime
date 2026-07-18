// @vitest-environment jsdom
// The NL quick-add renders a react-native-web TextInput, which needs a DOM.
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ScrollView } from 'react-native'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { ToastProvider } from '../components/core/Toast.js'
import { TimerProvider } from '../timer/TimerContext.js'
import { PomodoroProvider } from '../focus/PomodoroContext.js'
import { TestQueryProvider } from '../test/TestQueryProvider.js'
import { Button } from '../components/index.js'

/**
 * Today's data seams are injected so the review surfaces are testable without a backend:
 * one live-but-uncategorized entry drives the category-proposals card (REQ-012) and the
 * mocked idle-return hook drives the away-banner (REQ-033/#42). Both are proposal-only —
 * the tests press the buttons; nothing applies or stops on its own (ADR-0005). The mocks
 * keep the timer in demo mode, so the original layout/hero cases still hold.
 */
vi.mock('../hooks/useTodayEntries', () => ({
  useTodayEntries: () => ({
    data: [
      {
        id: 'e1',
        projectId: null,
        taskId: null,
        startedAt: '2026-07-18T08:00:00.000Z',
        endedAt: '2026-07-18T09:00:00.000Z',
        billable: false,
        source: 'timer',
        note: 'standup with team',
      },
    ],
    loading: false,
    error: null,
    reload: () => undefined,
    live: true,
    booked: [],
    bookedMs: 0,
  }),
}))

vi.mock('./useCatalog', () => ({
  useCatalog: () => ({
    data: [{ id: 'nexushero', name: 'NexusHero', projects: [{ id: 'p1', name: 'Website' }] }],
    loading: false,
    error: null,
    reload: () => undefined,
    live: true,
  }),
}))

const { proposeCategories, applyCategoryProposal } = vi.hoisted(() => ({
  proposeCategories: vi.fn((..._args: unknown[]) =>
    Promise.resolve({
      source: 'ai-proposal' as const,
      charged: true,
      proposals: [
        {
          key: 'e1',
          project: 'Website',
          tags: ['meeting'],
          billable: true,
          confidence: 'high' as const,
        },
      ],
    }),
  ),
  applyCategoryProposal: vi.fn(() => Promise.resolve({})),
}))
vi.mock('../api/categorize', () => ({ proposeCategories, applyCategoryProposal }))

vi.mock('../hooks/useIdleReturn', () => ({
  useIdleReturn: () => ({ idleMs: 12 * 60_000, dismiss: () => undefined }),
}))

import { TodayScreen } from './TodayScreen.js'

function render(): TestRenderer.ReactTestRenderer {
  // Today reads the shared timer + Pomodoro via context, confirms start/stop through the
  // Toast context (design v20), and its NL quick-add loads the catalog through TanStack
  // Query, so it renders inside all providers.
  return TestRenderer.create(
    <TestQueryProvider>
      <ThemeProvider>
        <ToastProvider>
          <TimerProvider>
            <PomodoroProvider>
              <TodayScreen />
            </PomodoroProvider>
          </TimerProvider>
        </ToastProvider>
      </ThemeProvider>
    </TestQueryProvider>,
  )
}

describe('TodayScreen Layout', () => {
  it('is one bounded scroll pane with bottom clearance (no floating Island on Today)', () => {
    const root = render().root
    // Exactly one scroll pane (bounded-screens rule); Today owns the clock via the
    // hero tracker, so the persistent Island is NOT rendered here (design v2).
    const scrollViews = root.findAllByType(ScrollView)
    expect(scrollViews.length).toBe(1)
    expect(scrollViews[0]!.props.contentContainerStyle.paddingBottom).toBe(40)
  })

  it('hero tracker shows the timer from the shared context (idle demo → 00:00:00, not hardcoded)', () => {
    const tree = JSON.stringify(render().toJSON())
    // Demo mode (no EXPO_PUBLIC_API_URL) starts with no running timer → 00:00:00,
    // proving the tracker reads the hook rather than the old static "00:42:11".
    expect(tree).toContain('00:00:00')
    expect(tree).not.toContain('00:42:11')
  })
})

describe('TodayScreen Category proposals (REQ-012)', () => {
  it('shows the card for a live uncategorized entry and renders the proposal row after Propose', async () => {
    const renderer = render()
    let tree = JSON.stringify(renderer.toJSON())
    expect(tree).toContain('Category proposals')
    expect(tree).toContain('standup with team')

    const button = renderer.root
      .findAllByType(Button)
      .find(b => b.props.children === 'Propose categories')
    expect(button).toBeDefined()
    await act(async () => {
      ;(button!.props.onPress as () => void)()
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(proposeCategories).toHaveBeenCalledTimes(1)
    // The narrow projection + the catalog vocabulary — never the whole entry.
    expect(proposeCategories.mock.calls[0]?.[1]).toEqual([
      { key: 'e1', note: 'standup with team', source: 'timer' },
    ])
    expect(proposeCategories.mock.calls[0]?.[2]).toEqual(['Website'])

    tree = JSON.stringify(renderer.toJSON())
    // Proposal row: entry label → proposed project, tags, confidence — with provenance,
    // and an Apply button (nothing was applied on its own).
    expect(tree).toContain('standup with team → Website')
    expect(tree).toContain('meeting')
    expect(tree).toContain('high')
    expect(tree).toContain('AI proposal')
    expect(tree).toContain('Apply')
    expect(applyCategoryProposal).not.toHaveBeenCalled()
  })
})

describe('TodayScreen Idle-return banner (REQ-033/#42)', () => {
  it('shows the away-banner with Keep/Stop only while a timer runs (mocked idle hook)', () => {
    const renderer = render()
    // Idle demo timer → no banner, even though the mocked hook reports an idle stretch.
    expect(JSON.stringify(renderer.toJSON())).not.toContain('You were away for')

    const start = renderer.root.findAll(n => n.props.accessibilityLabel === 'Start')[0]
    act(() => {
      ;(start!.props.onPress as () => void)()
    })
    const tree = JSON.stringify(renderer.toJSON())
    expect(tree).toContain('You were away for 0:12 h while the timer ran.')
    expect(tree).toContain('Keep time')
    expect(tree).toContain('Stop timer')
  })
})
