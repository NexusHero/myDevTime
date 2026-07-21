import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { PlannerLayerChips, type LayerChip } from './PlannerLayerChips.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the layer chips (issue #341, ux-vision §2.7): every
 * chip renders with its selected state exposed to assistive tech, one tap fires
 * exactly its own toggle, and the row invents no layer of its own — additional
 * surfaces (the #340 backlog rail) claim a chip by appending to the array.
 */

function render(chips: readonly LayerChip[]): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <PlannerLayerChips chips={chips} />
      </ThemeProvider>,
    )
  })
  return r
}

describe('PlannerLayerChips', () => {
  it('RendersEveryChipWithItsSelectedState', () => {
    const r = render([
      { key: 'reality', label: 'Reality', glyph: '●', active: false, onToggle: () => undefined },
      { key: 'ghosts', label: 'Ghosts', glyph: '◇', active: true, onToggle: () => undefined },
    ])
    const reality = r.root.findByProps({ accessibilityLabel: 'Reality layer' })
    const ghosts = r.root.findByProps({ accessibilityLabel: 'Ghosts layer' })
    expect(reality.props.accessibilityState).toEqual({ selected: false })
    expect(ghosts.props.accessibilityState).toEqual({ selected: true })
  })

  it('OneTap_FiresExactlyThatChipsToggle', () => {
    const onReality = vi.fn()
    const onGhosts = vi.fn()
    const r = render([
      { key: 'reality', label: 'Reality', active: false, onToggle: onReality },
      { key: 'ghosts', label: 'Ghosts', active: false, onToggle: onGhosts },
    ])
    act(() => {
      r.root.findByProps({ accessibilityLabel: 'Reality layer' }).props.onPress()
    })
    expect(onReality).toHaveBeenCalledTimes(1)
    expect(onGhosts).not.toHaveBeenCalled()
  })

  it('AppendedChips_RenderInOrder_TheRailSlotContract', () => {
    // The #340 backlog rail claims its chip by appending — nothing else changes.
    const r = render([
      { key: 'reality', label: 'Reality', active: false, onToggle: () => undefined },
      { key: 'backlog', label: 'Backlog', active: false, onToggle: () => undefined },
    ])
    const labels: string[] = []
    for (const n of r.root.findAll(n => n.props.accessibilityRole === 'button')) {
      const l = n.props.accessibilityLabel as unknown
      // react-native-web renders one Pressable as several host nodes carrying the
      // same role/label — dedupe consecutively so we read the chip *order*, not count.
      if (typeof l === 'string' && l.endsWith(' layer') && labels[labels.length - 1] !== l) {
        labels.push(l)
      }
    }
    expect(labels).toEqual(['Reality layer', 'Backlog layer'])
  })
})
