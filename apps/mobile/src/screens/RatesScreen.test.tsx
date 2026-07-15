// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { TestQueryProvider } from '../test/TestQueryProvider.js'
import { SegmentedControl } from '../components/index.js'

/**
 * The Rates screen manages the workspace's rate rules (REQ-005). The app fabricates
 * no data, so these tests inject rates + a catalog through the hook seams (the
 * "demo in tests, empty in production" contract) and pin that the screen mounts,
 * renders the add-form and the grouped current rates, and that picking the Client
 * level reveals the client picker with the injected client.
 */
vi.mock('../hooks/useRates', () => ({
  useRates: () => ({
    data: [
      {
        id: 'r1',
        level: 'workspace',
        scopeId: null,
        amountMinorPerHour: 9000,
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      },
    ],
    loading: false,
    error: null,
    reload: () => undefined,
    live: true,
    create: () => Promise.resolve(),
    remove: () => Promise.resolve(),
  }),
}))

vi.mock('./useCatalog', () => ({
  useCatalog: () => ({
    data: [{ id: 'nexushero', name: 'NexusHero', projects: [] }],
    loading: false,
    error: null,
    reload: () => undefined,
    live: true,
  }),
}))

const { RatesScreen } = await import('./RatesScreen.js')

async function render(): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer
  await act(async () => {
    renderer = TestRenderer.create(
      <TestQueryProvider>
        <ThemeProvider>
          <RatesScreen onBack={() => undefined} />
        </ThemeProvider>
      </TestQueryProvider>,
    )
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return renderer
}

describe('RatesScreen', () => {
  it('MountsWithTheAddForm_AndTheInjectedRates', async () => {
    const tree = JSON.stringify((await render()).toJSON())
    expect(tree).toContain('Hourly rates') // header
    expect(tree).toContain('Add a rate') // form card
    expect(tree).toContain('Workspace default') // the injected workspace rate row
  })

  it('PickingClient_RevealsTheClientPicker', async () => {
    const renderer = await render()
    const seg = renderer.root.findAllByType(SegmentedControl)[0]
    act(() => {
      seg!.props.onChange('client')
    })
    const tree = JSON.stringify(renderer.toJSON())
    // The injected catalog's client appears as a selectable option.
    expect(tree).toContain('NexusHero')
  })
})
