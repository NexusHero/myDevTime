// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import { Switch } from './Switch.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the form Switch: RNW can't emit `aria-checked` for a
 * `switch` role, so it presents as a `button` whose on/off state is folded into the
 * accessible name and exposed via `accessibilityState.checked` (REQ-043). Toggling
 * fires with the negated value; keyboard focus draws the visible focus ring.
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

function styleOf(r: TestRenderer.ReactTestRenderer): Record<string, unknown> {
  return r.root.findByType(Pressable).props.style as Record<string, unknown>
}

describe('Switch', () => {
  it('FoldsOnOffStateIntoTheAccessibleNameAndState', () => {
    const r = render(<Switch checked label="Notifications" />)
    const p = r.root.findByType(Pressable)
    expect(p.props.accessibilityRole).toBe('button')
    expect(p.props.accessibilityLabel).toBe('Notifications, on')
    expect(p.props.accessibilityState).toEqual({ checked: true })
  })

  it('Unchecked_ReadsOff', () => {
    const r = render(<Switch checked={false} accessibilityLabel="Dark mode" />)
    expect(r.root.findByType(Pressable).props.accessibilityLabel).toBe('Dark mode, off')
  })

  it('Press_TogglesWithTheNegatedValue', () => {
    const onChange = vi.fn()
    const r = render(<Switch checked={false} label="Notifications" onChange={onChange} />)
    act(() => {
      r.root.findByType(Pressable).props.onPress()
    })
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('Focus_TogglesTheVisibleFocusRing', () => {
    const r = render(<Switch checked label="Notifications" />)
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
