// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { ToastProvider } from '../components/core/Toast.js'

/**
 * The Sevi weekday mood-pattern note in Reports' Balance area (REQ-068, ADR-0071). The data
 * hooks are mocked as in the sibling Reports tests; `useMoodPattern` is driven per test so the
 * contract is pinned both ways: a flagged weekday renders exactly ONE calm, accessible line
 * ("Tuesdays often tense"), and without a pattern the note stays entirely away — no filler,
 * no empty state.
 */
vi.mock('../hooks/useReports', () => ({
  useReports: () => ({ data: null, loading: false, error: null, reload: () => undefined }),
}))
vi.mock('../hooks/useRevenueBudget', () => ({
  useRevenueBudget: () => ({ data: null, loading: false, error: null, reload: () => undefined }),
}))
vi.mock('../hooks/useOvertimeTrend', () => ({
  useOvertimeTrend: () => ({ data: null, loading: false, error: null, reload: () => undefined }),
}))
vi.mock('../hooks/useBalance', () => ({
  useBalance: () => ({ data: null, loading: false, error: null, reload: () => undefined }),
}))
vi.mock('../hooks/useCheckin', () => ({
  useCheckin: () => ({ done: false, submit: () => undefined }),
}))
vi.mock('../hooks/useTrackingHeatmap', () => ({
  useTrackingHeatmap: () => ({ data: null, loading: false, error: null, reload: () => undefined }),
}))
vi.mock('../hooks/useBudgetBurndown', () => ({
  useBudgetBurndown: () => ({
    data: null,
    projection: null,
    loading: false,
    error: null,
    reload: () => undefined,
  }),
}))

const { useMoodPattern } = vi.hoisted(() => ({ useMoodPattern: vi.fn() }))
vi.mock('../hooks/useMoodPattern', async importOriginal => ({
  // Keep the real `moodPatternNote` — the note wording itself is part of the pinned contract.
  ...(await importOriginal<typeof import('../hooks/useMoodPattern.js')>()),
  useMoodPattern,
}))

const { ReportsScreen } = await import('./ReportsScreen.js')

async function render(): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer
  await act(async () => {
    renderer = TestRenderer.create(
      <ThemeProvider>
        <ToastProvider>
          <ReportsScreen />
        </ToastProvider>
      </ThemeProvider>,
    )
  })
  return renderer
}

/** Switch to the Balance view via its header toggle (a Pressable wrapping the label Text). */
async function openBalance(renderer: TestRenderer.ReactTestRenderer): Promise<void> {
  const label = renderer.root.findAll(
    n => typeof n.type === 'string' && n.props.children === 'Balance',
  )[0]
  expect(label, 'Balance view toggle').toBeDefined()
  let node = label!.parent
  while (node && typeof node.props.onPress !== 'function') node = node.parent
  expect(node, 'pressable Balance toggle').toBeDefined()
  await act(async () => {
    ;(node!.props.onPress as () => void)()
  })
}

describe('ReportsScreen mood-pattern note', () => {
  it('FlaggedTuesdayPattern_ShowsTheCalmNoteInTheBalanceArea', async () => {
    useMoodPattern.mockReturnValue({
      pattern: { lowWeekdays: [{ weekday: 2, medianMood: 2 }], enoughData: true },
      loading: false,
    })
    const renderer = await render()
    await openBalance(renderer)
    const note = renderer.root.findAllByProps({ testID: 'mood-pattern-note' })
    expect(note.length).toBeGreaterThan(0)
    expect(note[0]!.props.accessibilityLabel).toBe('Tuesdays often tense')
    expect(JSON.stringify(renderer.toJSON())).toContain('Tuesdays often tense')
  })

  it('NoPattern_KeepsTheNoteEntirelyAway', async () => {
    useMoodPattern.mockReturnValue({
      pattern: { lowWeekdays: [], enoughData: false },
      loading: false,
    })
    const renderer = await render()
    await openBalance(renderer)
    expect(renderer.root.findAllByProps({ testID: 'mood-pattern-note' })).toHaveLength(0)
    expect(JSON.stringify(renderer.toJSON())).not.toContain('often tense')
  })
})
