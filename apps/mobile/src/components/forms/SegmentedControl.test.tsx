import { describe, expect, it, vi } from 'vitest'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import { SegmentedControl } from './SegmentedControl.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

describe('SegmentedControl', () => {
  it('renders all segments and highlights the active one', () => {
    const onChange = vi.fn()
    const segments = [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B' },
    ]

    const renderer = TestRenderer.create(
      <ThemeProvider>
        <SegmentedControl segments={segments} active="a" onChange={onChange} />
      </ThemeProvider>,
    )

    const root = renderer.root
    const pressables = root.findAllByType(Pressable)

    expect(pressables.length).toBe(2)

    // Check accessibility state
    expect(pressables[0]!.props.accessibilityState.selected).toBe(true)
    expect(pressables[1]!.props.accessibilityState.selected).toBe(false)

    // Trigger change
    pressables[1]!.props.onPress()
    expect(onChange).toHaveBeenCalledWith('b')
  })
})
