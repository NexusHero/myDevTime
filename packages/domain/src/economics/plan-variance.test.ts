import { describe, expect, it } from 'vitest'
import { planVsRealized } from './plan-variance.js'

/**
 * Acceptance for the plan-vs-realized revenue core (REQ-061, design v17 §K4). A fixed-fee
 * project carries a calculated (planned) revenue; the realized revenue is what the tracked
 * work actually earns. The "Plan ±x%" chip is this comparison — deterministic (ADR-0005),
 * the number is code's; the client only colours and labels it.
 */
describe('planVsRealized', () => {
  it('IsOnPlanWithinTheTolerance', () => {
    const v = planVsRealized(100_00, 101_00) // +1% ≤ 2% tolerance
    expect(v.status).toBe('on')
    expect(v.variancePct).toBe(1)
    expect(v.deltaMinor).toBe(100)
  })

  it('IsOverWhenRealizedExceedsPlanBeyondTolerance', () => {
    const v = planVsRealized(100_00, 130_00)
    expect(v.status).toBe('over')
    expect(v.variancePct).toBe(30)
    expect(v.deltaMinor).toBe(30_00)
  })

  it('IsUnderWhenRealizedTrailsPlanBeyondTolerance', () => {
    const v = planVsRealized(100_00, 80_00)
    expect(v.status).toBe('under')
    expect(v.variancePct).toBe(-20)
    expect(v.deltaMinor).toBe(-20_00)
  })

  it('RespectsACustomTolerance', () => {
    expect(planVsRealized(100_00, 105_00, { tolerancePct: 10 }).status).toBe('on')
    expect(planVsRealized(100_00, 105_00, { tolerancePct: 1 }).status).toBe('over')
  })

  it('HasNoPercentageWhenThePlanIsZero_StatusBySign', () => {
    expect(planVsRealized(0, 0)).toMatchObject({ variancePct: null, status: 'on' })
    expect(planVsRealized(0, 5_00)).toMatchObject({ variancePct: null, status: 'over' })
  })

  it('RoundsThePercentageToAWholeNumber', () => {
    // 100.00 → 133.33 = +33.33% → 33.
    expect(planVsRealized(100_00, 133_33).variancePct).toBe(33)
  })
})
