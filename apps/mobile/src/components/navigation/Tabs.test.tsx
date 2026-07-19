// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import { Tabs } from './Tabs.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the navigation Tabs: each tab is a named `button`
 * (the `tab` role needs a `tablist`/`aria-selected` pair RNW cannot emit) that
 * carries its selected state, fires on press, and shows the visible focus ring on
 * the one focused tab (REQ-043).
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

const items = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
] as const

describe('Tabs', () => {
  it('EachTab_IsANamedButtonWithSelectedState', () => {
    const r = render(<Tabs items={items} active="week" />)
    const tabs = r.root.findAllByType(Pressable)
    expect(tabs).toHaveLength(2)
    expect(tabs[0]!.props.accessibilityRole).toBe('button')
    expect(tabs[0]!.props.accessibilityLabel).toBe('Week')
    expect(tabs[0]!.props.accessibilityState).toEqual({ selected: true })
    expect(tabs[1]!.props.accessibilityState).toEqual({ selected: false })
  })

  it('Press_FiresOnChangeWithTheValue', () => {
    const onChange = vi.fn()
    const r = render(<Tabs items={items} active="week" onChange={onChange} />)
    act(() => {
      r.root.findAllByType(Pressable)[1]!.props.onPress()
    })
    expect(onChange).toHaveBeenCalledWith('month')
  })

  it('Focus_ShowsTheVisibleFocusRingOnlyOnTheFocusedTab', () => {
    const r = render(<Tabs items={items} active="week" />)
    const styleOf = (i: number): Record<string, unknown> =>
      r.root.findAllByType(Pressable)[i]!.props.style as Record<string, unknown>
    expect(styleOf(0).outlineStyle).toBe('none')

    act(() => {
      r.root.findAllByType(Pressable)[1]!.props.onFocus()
    })
    expect(styleOf(1).outlineStyle).toBe('solid')
    expect(styleOf(0).outlineStyle).toBe('none')

    act(() => {
      r.root.findAllByType(Pressable)[1]!.props.onBlur()
    })
    expect(styleOf(1).outlineStyle).toBe('none')
  })
})
