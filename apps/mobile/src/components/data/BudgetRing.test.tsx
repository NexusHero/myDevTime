import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { BudgetRing } from './BudgetRing.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Under the render-test env the reanimated shim reports reduced-motion ON
 * (test/__mocks__/react-native-reanimated), so `useMountValue` resolves to its
 * target immediately: the ring's count-up must land on the real percentage, not
 * a mid-animation frame. This guards the instrument's rest state after the v4
 * motion pass.
 */
describe('BudgetRing (motion rest state)', () => {
  it('BudgetRing_reducedMotion_showsFinalPercent', () => {
    let r!: TestRenderer.ReactTestRenderer
    act(() => {
      r = TestRenderer.create(
        <ThemeProvider>
          <BudgetRing ratio={0.62} label="Sync engine" />
        </ThemeProvider>,
      )
    })
    expect(JSON.stringify(r.toJSON())).toContain('62%')
  })

  it('BudgetRing_overBudget_showsClampedFullRingLabel', () => {
    let r!: TestRenderer.ReactTestRenderer
    act(() => {
      r = TestRenderer.create(
        <ThemeProvider>
          <BudgetRing ratio={1.2} />
        </ThemeProvider>,
      )
    })
    // Label reports the true 120% even though the arc is clamped to a full ring.
    expect(JSON.stringify(r.toJSON())).toContain('120%')
  })
})
