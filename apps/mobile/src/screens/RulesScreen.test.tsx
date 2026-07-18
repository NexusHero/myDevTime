// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { TestQueryProvider } from '../test/TestQueryProvider.js'
import { SegmentedControl } from '../components/index.js'

/**
 * The Rules screen manages the workspace's categorization rules (REQ-011). The app fabricates no
 * data, so these tests inject rules + a catalog through the hook seams and pin that the screen
 * mounts, renders the add-form and the current rules with their matcher/action summaries, and that
 * the source segment drives the matcher. The engine only proposes — this UI never books.
 */
vi.mock('../hooks/useRules', () => ({
  useRules: () => ({
    data: [
      {
        id: 'r1',
        order: 0,
        version: 1,
        matcher: { noteContains: 'standup', sourceIs: 'calendar' },
        action: { setProjectId: 'p1', setBillable: false },
        enabled: true,
      },
    ],
    loading: false,
    error: null,
    reload: () => undefined,
    live: true,
    create: () => Promise.resolve(),
    update: () => Promise.resolve(),
    remove: () => Promise.resolve(),
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

const { RulesScreen } = await import('./RulesScreen.js')

async function render(): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer
  await act(async () => {
    renderer = TestRenderer.create(
      <TestQueryProvider>
        <ThemeProvider>
          <RulesScreen onBack={() => undefined} />
        </ThemeProvider>
      </TestQueryProvider>,
    )
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return renderer
}

describe('RulesScreen', () => {
  it('MountsWithTheAddForm_AndTheInjectedRuleSummary', async () => {
    const tree = JSON.stringify((await render()).toJSON())
    expect(tree).toContain('Categorization rules') // header
    expect(tree).toContain('Add a rule') // form card
    // The injected rule renders its matcher + action summary (note + source, project name).
    expect(tree).toContain('standup')
    expect(tree).toContain('NexusHero · Website')
    expect(tree).toContain('non-billable')
  })

  it('PickingSource_KeepsTheFormMounted', async () => {
    const renderer = await render()
    const seg = renderer.root.findAllByType(SegmentedControl)[0]
    act(() => {
      seg!.props.onChange('timer')
    })
    const tree = JSON.stringify(renderer.toJSON())
    expect(tree).toContain('Add a rule')
  })
})
