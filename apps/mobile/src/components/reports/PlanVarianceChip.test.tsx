import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { PlanVarianceChip } from './PlanVarianceChip.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the "Plan ±x%" chip (REQ-061, design v17 §K4): the label + tone
 * come straight from the deterministic `planVsRealized` core; the chip only presents them, and
 * shows nothing when there is no expected (fixed-fee) revenue to compare against.
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

function texts(r: TestRenderer.ReactTestRenderer): string {
  return r.root
    .findAll(n => typeof n.type === 'string')
    .flatMap(n => n.children)
    .filter((c): c is string => typeof c === 'string')
    .join(' ')
}

describe('PlanVarianceChip', () => {
  it('NoExpectedRevenue_rendersNothing', () => {
    const r = render(<PlanVarianceChip expectedMinor={0} realizedMinor={5000} />)
    expect(r.toJSON()).toBeNull()
  })

  it('RealizedOverPlan_showsASignedPositiveVariance', () => {
    // plan 100.00, realized 130.00 → +30 %.
    const r = render(<PlanVarianceChip expectedMinor={10000} realizedMinor={13000} />)
    expect(texts(r)).toContain('Plan +30%')
  })

  it('RealizedUnderPlan_showsANegativeVariance', () => {
    const r = render(<PlanVarianceChip expectedMinor={10000} realizedMinor={7000} />)
    expect(texts(r)).toContain('Plan -30%')
  })

  it('WithinTolerance_readsPlanOn', () => {
    // 1 % delta is inside the default 2 % band.
    const r = render(<PlanVarianceChip expectedMinor={10000} realizedMinor={10100} />)
    expect(texts(r)).toContain('Plan on')
  })
})
