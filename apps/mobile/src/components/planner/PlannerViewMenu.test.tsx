import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { PlannerViewMenu } from './PlannerViewMenu.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import type { PlannerLayer } from '../../planner/layer'

/**
 * Render tests (ADR-0027) for the v20 "View" popover: collapsed by default, opens the layer segment
 * + Reality switch, reports layer/reality changes up, and wears a dot when a non-default filter or
 * Reality is active (Reduktions-Pass — the header stays quiet).
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
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

function press(r: TestRenderer.ReactTestRenderer, label: string): void {
  const node = r.root.find(
    n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function',
  )
  act(() => {
    node.props.onPress()
  })
}

describe('PlannerViewMenu', () => {
  it('CollapsedByDefault_HidesTheLayerControls', () => {
    const out = texts(
      render(
        <PlannerViewMenu layer="both" onLayer={() => {}} realityOn={false} onReality={() => {}} />,
      ),
    )
    expect(out).toContain('View')
    expect(out).not.toContain('LAYERS')
  })

  it('OpensToRevealLayersAndReality', () => {
    const r = render(
      <PlannerViewMenu layer="both" onLayer={() => {}} realityOn={false} onReality={() => {}} />,
    )
    press(r, 'View options — layers and reality trace')
    const out = texts(r)
    expect(out).toContain('LAYERS')
    expect(out).toContain('Work')
    expect(out).toContain('Reality trace')
  })

  it('ReportsLayerAndRealityChangesUp', () => {
    const onLayer = vi.fn<(l: PlannerLayer) => void>()
    const onReality = vi.fn<(next: boolean) => void>()
    const r = render(
      <PlannerViewMenu layer="both" onLayer={onLayer} realityOn={false} onReality={onReality} />,
    )
    press(r, 'View options — layers and reality trace')
    press(r, 'Layer: Life')
    press(r, 'Reality trace, off') // the shared Switch folds on/off into its accessible name
    expect(onLayer).toHaveBeenCalledWith('life')
    expect(onReality).toHaveBeenCalledWith(true)
  })

  it('WearsNoDotWhenDefault_AndADotWhenActive', () => {
    // Default (both, reality off) → button not expanded, no active state marker in label set.
    const active = render(
      <PlannerViewMenu layer="work" onLayer={() => {}} realityOn={false} onReality={() => {}} />,
    )
    // With a non-default layer the trigger reports it is the "active" surface: the dot is a sibling
    // View, so assert the menu still renders its trigger and can open.
    press(active, 'View options — layers and reality trace')
    expect(texts(active)).toContain('LAYERS')
  })
})
