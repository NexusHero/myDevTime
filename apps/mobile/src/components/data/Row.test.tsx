// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable, View } from 'react-native'
import { Row } from './Row.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the data Row: a tappable row is a named `button`
 * with a visible focus ring (REQ-043), a static row carries no interactive role at
 * all (so screen readers and axe don't announce a control that does nothing).
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

function styleOf(r: TestRenderer.ReactTestRenderer): Record<string, unknown> {
  const p = r.root.findByType(Pressable)
  return (p.props.style as (s: { pressed: boolean }) => Record<string, unknown>)({
    pressed: false,
  })
}

describe('Row', () => {
  it('Tappable_IsANamedButton', () => {
    const r = render(<Row title="Notifications" onPress={() => {}} />)
    const p = r.root.findByType(Pressable)
    expect(p.props.accessibilityRole).toBe('button')
    expect(p.props.accessibilityLabel).toBe('Notifications')
  })

  it('Static_HasNoInteractiveRole', () => {
    const r = render(<Row title="Version" subtitle="1.0.0" />)
    expect(r.root.findAllByType(Pressable)).toHaveLength(0)
    expect(r.root.findAllByType(View).length).toBeGreaterThan(0)
  })

  it('Press_FiresOnPress', () => {
    const onPress = vi.fn()
    const r = render(<Row title="Notifications" onPress={onPress} />)
    act(() => {
      r.root.findByType(Pressable).props.onPress()
    })
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('Focus_TogglesTheVisibleFocusRing', () => {
    const r = render(<Row title="Notifications" onPress={() => {}} />)
    expect(styleOf(r).outlineStyle).toBe('none')

    act(() => {
      r.root.findByType(Pressable).props.onFocus()
    })
    expect(styleOf(r).outlineStyle).toBe('solid')

    act(() => {
      r.root.findByType(Pressable).props.onBlur()
    })
    expect(styleOf(r).outlineStyle).toBe('none')
  })
})
