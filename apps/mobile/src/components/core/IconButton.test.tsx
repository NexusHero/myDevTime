// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable, Text } from 'react-native'
import { IconButton } from './IconButton.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the core IconButton, an icon-only control: it MUST
 * carry an accessible name so react-native-web maps it to a named `button` (REQ-043),
 * expose its active state, and show the visible focus ring on keyboard focus.
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

/** The IconButton's resolved (unpressed) style — its `style` prop is a function of press state. */
function styleOf(r: TestRenderer.ReactTestRenderer): Record<string, unknown> {
  const p = r.root.findByType(Pressable)
  return (p.props.style as (s: { pressed: boolean }) => Record<string, unknown>)({
    pressed: false,
  })
}

describe('IconButton', () => {
  it('IconOnly_CarriesAccessibleNameAndButtonRole', () => {
    const r = render(<IconButton icon={<Text>▶</Text>} label="Play" />)
    const p = r.root.findByType(Pressable)
    expect(p.props.accessibilityRole).toBe('button')
    expect(p.props.accessibilityLabel).toBe('Play')
  })

  it('Active_ReflectsSelectedState', () => {
    const r = render(<IconButton icon={<Text>▶</Text>} label="Play" active />)
    expect(r.root.findByType(Pressable).props.accessibilityState).toEqual({ selected: true })
  })

  it('Press_FiresOnPress', () => {
    const onPress = vi.fn()
    const r = render(<IconButton icon={<Text>▶</Text>} label="Play" onPress={onPress} />)
    act(() => {
      r.root.findByType(Pressable).props.onPress()
    })
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('Focus_TogglesTheVisibleFocusRing', () => {
    const r = render(<IconButton icon={<Text>▶</Text>} label="Play" />)
    expect(styleOf(r).outlineStyle).toBe('none')

    act(() => {
      r.root.findByType(Pressable).props.onFocus()
    })
    const focused = styleOf(r)
    expect(focused.outlineStyle).toBe('solid')
    expect(focused.outlineWidth).toBe(2)
    expect(typeof focused.outlineColor).toBe('string')

    act(() => {
      r.root.findByType(Pressable).props.onBlur()
    })
    expect(styleOf(r).outlineStyle).toBe('none')
  })
})
