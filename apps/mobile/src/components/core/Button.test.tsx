// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import { Button } from './Button.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the core Button: press dispatches, and keyboard focus
 * toggles the visible focus ring (REQ-043, ADR-0062) — the web-only accent outline
 * appears on focus and drops back to the suppressed default on blur.
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

/** The Button's resolved (unpressed) style — its `style` prop is a function of press state. */
function styleOf(r: TestRenderer.ReactTestRenderer): Record<string, unknown> {
  const p = r.root.findByType(Pressable)
  return (p.props.style as (s: { pressed: boolean }) => Record<string, unknown>)({
    pressed: false,
  })
}

describe('Button', () => {
  it('Press_FiresOnPress', () => {
    const onPress = vi.fn()
    const r = render(<Button onPress={onPress}>Save</Button>)
    act(() => {
      r.root.findByType(Pressable).props.onPress()
    })
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('Focus_TogglesTheVisibleFocusRing', () => {
    const r = render(<Button>Save</Button>)

    // Unfocused: no ring — the UA default outline is suppressed, nothing else changes.
    expect(styleOf(r).outlineStyle).toBe('none')
    expect(styleOf(r).outlineColor).toBeUndefined()

    act(() => {
      r.root.findByType(Pressable).props.onFocus()
    })
    const focused = styleOf(r)
    expect(focused.outlineStyle).toBe('solid')
    expect(focused.outlineWidth).toBe(2)
    expect(focused.outlineOffset).toBe(2)
    expect(typeof focused.outlineColor).toBe('string') // the theme accent

    act(() => {
      r.root.findByType(Pressable).props.onBlur()
    })
    expect(styleOf(r).outlineStyle).toBe('none')
  })
})
