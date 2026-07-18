// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { ToastProvider } from '../components/core/Toast.js'
import { Button } from '../components/index.js'

/**
 * The Reports standup surface (REQ-014). The app fabricates no data, so every data hook the
 * screen reads is injected through its seam; the standup api module is mocked so the test pins
 * the CLIENT contract: the card renders, Generate sends the window's per-project lines, and the
 * result shows the text WITH its provenance badge — an AI narration is always labeled
 * "AI proposal" (ADR-0005).
 */
vi.mock('../hooks/useReports', () => ({
  useReports: () => ({
    data: {
      totalMs: 5_400_000,
      billableMs: 3_600_000,
      billableMinor: 0,
      currencyCode: 'EUR',
      byProject: [
        { id: 'p1', name: 'Website', spentMs: 3_600_000 },
        { id: 'p2', name: 'Internal', spentMs: 1_800_000 },
      ],
      budgets: [],
      overtimeMs: 0,
    },
    loading: false,
    error: null,
    reload: () => undefined,
    live: true,
  }),
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

const { generateStandup } = vi.hoisted(() => ({
  generateStandup: vi.fn((..._args: unknown[]) =>
    Promise.resolve({
      source: 'ai-proposal' as const,
      text: 'Yesterday I moved Website forward; Internal got the rest.',
      charged: true,
      report: {},
    }),
  ),
}))
vi.mock('../api/standup', () => ({ generateStandup }))

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

describe('ReportsScreen standup', () => {
  it('RendersTheStandupCard_WithItsGenerateButton', async () => {
    const renderer = await render()
    const tree = JSON.stringify(renderer.toJSON())
    expect(tree).toContain('Standup')
    expect(tree).toContain('Generate standup')
    expect(tree).toContain('nothing is written back')
  })

  it('Generate_SendsTheWindowLines_AndShowsTheTextWithTheAiProposalBadge', async () => {
    const renderer = await render()
    const button = renderer.root
      .findAllByType(Button)
      .find(b => b.props.children === 'Generate standup')
    expect(button).toBeDefined()
    await act(async () => {
      ;(button!.props.onPress as () => void)()
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    // The client sent the screen's real per-project lines — never an invented split.
    expect(generateStandup).toHaveBeenCalledTimes(1)
    const input = generateStandup.mock.calls[0]?.[1] as {
      today: readonly { label: string; ms: number }[]
      yesterday: readonly unknown[]
      blockers: readonly unknown[]
    }
    expect(input.today).toEqual([
      { label: 'Website', ms: 3_600_000 },
      { label: 'Internal', ms: 1_800_000 },
    ])
    expect(input.yesterday).toEqual([])
    expect(input.blockers).toEqual([])
    const tree = JSON.stringify(renderer.toJSON())
    expect(tree).toContain('Yesterday I moved Website forward')
    expect(tree).toContain('AI proposal')
  })
})
