// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { TestQueryProvider } from '../test/TestQueryProvider.js'
import { RatesScreen } from './RatesScreen.js'
import { SegmentedControl } from '../components/index.js'

/**
 * The Rates screen manages the workspace's rate rules (REQ-005). With no API
 * configured it shows the demo set; these pin that it mounts, renders the add-form
 * and the grouped current rates, flags demo data, and that picking the Client level
 * reveals the client picker.
 */
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
  // Flush React Query's async resolution of the demo data + the re-render.
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return renderer
}

describe('RatesScreen', () => {
  it('MountsWithTheAddFormAndDemoData', async () => {
    const tree = JSON.stringify((await render()).toJSON())
    expect(tree).toContain('Hourly rates') // header
    expect(tree).toContain('Add a rate') // form card
    expect(tree).toContain('Demo data') // no API → demo badge
    expect(tree).toContain('Workspace default') // demo workspace rate row
  })

  it('PickingClient_RevealsTheClientPicker', async () => {
    const renderer = await render()
    const seg = renderer.root.findAllByType(SegmentedControl)[0]
    act(() => {
      seg!.props.onChange('client')
    })
    const tree = JSON.stringify(renderer.toJSON())
    // The demo catalog's client appears as a selectable option.
    expect(tree).toContain('NexusHero')
  })
})
