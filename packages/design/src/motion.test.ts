import { describe, expect, it } from 'vitest'
import { clamp01, easeOutCubic, easeTo } from './motion.js'

describe('clamp01', () => {
  it('clamp01_withinUnitInterval_returnsInput', () => {
    expect(clamp01(0)).toBe(0)
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(1)).toBe(1)
  })

  it('clamp01_belowZero_clampsToZero', () => {
    expect(clamp01(-0.3)).toBe(0)
    expect(clamp01(-100)).toBe(0)
  })

  it('clamp01_aboveOne_clampsToOne', () => {
    expect(clamp01(1.2)).toBe(1)
    expect(clamp01(50)).toBe(1)
  })

  it('clamp01_nan_returnsZero', () => {
    expect(clamp01(Number.NaN)).toBe(0)
  })
})

describe('easeOutCubic', () => {
  it('easeOutCubic_atEndpoints_isIdentity', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
  })

  it('easeOutCubic_atMidpoint_isAheadOfLinear', () => {
    // Ease-out is faster early: value at p=0.5 exceeds the linear 0.5.
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 3)
  })

  it('easeOutCubic_isMonotonicallyIncreasing', () => {
    let prev = -1
    for (let p = 0; p <= 1.0001; p += 0.1) {
      const v = easeOutCubic(p)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('easeOutCubic_outOfRangeInput_isClamped', () => {
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
  })
})

describe('easeTo', () => {
  it('easeTo_atStart_isZero', () => {
    expect(easeTo(100, 0)).toBe(0)
  })

  it('easeTo_atEnd_reachesTarget', () => {
    expect(easeTo(100, 1)).toBe(100)
  })

  it('easeTo_negativeTarget_easesTowardNegative', () => {
    expect(easeTo(-8, 1)).toBe(-8)
    expect(easeTo(-8, 0.5)).toBeCloseTo(-7, 5)
  })
})
