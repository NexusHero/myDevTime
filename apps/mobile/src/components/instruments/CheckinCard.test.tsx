import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import { CheckinCard } from './CheckinCard.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * CheckinCard is the OLBI short-form weekly check-in: two 1–5 scales, save only when
 * both are answered, then a collapsed confirmation. It states the local-only contract
 * ("stays on your device"). These pin that copy, the save-guard, and the done state.
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

const text = (r: TestRenderer.ReactTestRenderer): string => JSON.stringify(r.toJSON())

function press(r: TestRenderer.ReactTestRenderer, label: string): void {
  const btn = r.root.findAllByType(Pressable).find(b => b.props.accessibilityLabel === label)
  if (!btn) throw new Error(`no pressable "${label}"`)
  act(() => {
    ;(btn.props.onPress as () => void)()
  })
}

describe('CheckinCard', () => {
  it('StatesTheLocalOnlyContract', () => {
    const r = render(<CheckinCard done={false} onSubmit={vi.fn()} />)
    expect(text(r)).toContain('stays on your device')
  })

  it('SaveIsGuardedUntilBothItemsAnswered', () => {
    const onSubmit = vi.fn()
    const r = render(<CheckinCard done={false} onSubmit={onSubmit} />)
    // Answer only exhaustion → save is still a no-op.
    press(r, 'Worn out: 4 of 5')
    press(r, 'Save check-in')
    expect(onSubmit).not.toHaveBeenCalled()
    // Answer detachment too → save reports both values.
    press(r, 'Disengaged: 2 of 5')
    press(r, 'Save check-in')
    expect(onSubmit).toHaveBeenCalledWith({ exhaustion: 4, detachment: 2 })
  })

  it('Done_CollapsesToConfirmationWithNoScales', () => {
    const r = render(<CheckinCard done onSubmit={vi.fn()} />)
    expect(text(r)).toContain('Checked in for this week')
    // No scale buttons in the collapsed state.
    const radios = r.root
      .findAllByType(Pressable)
      .filter(b => b.props.accessibilityRole === 'radio')
    expect(radios).toHaveLength(0)
  })
})
