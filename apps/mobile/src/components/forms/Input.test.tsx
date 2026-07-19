// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { TextInput } from 'react-native'
import { Input } from './Input.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the form Input: the field always exposes an accessible
 * name (its label, or the placeholder when unlabeled) so react-native-web renders a
 * named `textbox` (REQ-043), and keyboard focus draws the visible focus ring.
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

function styleOf(r: TestRenderer.ReactTestRenderer): Record<string, unknown> {
  return r.root.findByType(TextInput).props.style as Record<string, unknown>
}

describe('Input', () => {
  it('Labeled_UsesTheLabelAsAccessibleName', () => {
    const r = render(<Input label="Email" placeholder="you@company.com" />)
    expect(r.root.findByType(TextInput).props.accessibilityLabel).toBe('Email')
  })

  it('Unlabeled_FallsBackToThePlaceholder', () => {
    const r = render(<Input placeholder="you@company.com" />)
    expect(r.root.findByType(TextInput).props.accessibilityLabel).toBe('you@company.com')
  })

  it('Change_FiresOnChangeText', () => {
    const onChangeText = vi.fn()
    const r = render(<Input label="Email" onChangeText={onChangeText} />)
    act(() => {
      r.root.findByType(TextInput).props.onChangeText('a@b.co')
    })
    expect(onChangeText).toHaveBeenCalledWith('a@b.co')
  })

  it('Focus_TogglesTheVisibleFocusRing', () => {
    const r = render(<Input label="Email" />)
    expect(styleOf(r).outlineStyle).toBe('none')

    act(() => {
      r.root.findByType(TextInput).props.onFocus()
    })
    expect(styleOf(r).outlineStyle).toBe('solid')

    act(() => {
      r.root.findByType(TextInput).props.onBlur()
    })
    expect(styleOf(r).outlineStyle).toBe('none')
  })
})
