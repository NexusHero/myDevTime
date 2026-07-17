import { describe, expect, it } from 'vitest'
import { baselineRange, estimateVsActual, rangeMidpoint, resolveEstimate } from './effort.js'

describe('baselineRange', () => {
  it('IsAHoursRange_notASingleNumber', () => {
    const r = baselineRange('feature', 'medium')
    expect(r.minHours).toBeLessThan(r.maxHours)
    expect(r).toEqual({ minHours: 3, maxHours: 8 })
  })

  it('ResearchWidensTheBand_choreTightensIt', () => {
    const research = baselineRange('research', 'medium')
    const chore = baselineRange('chore', 'medium')
    expect(research.maxHours).toBeGreaterThan(baselineRange('feature', 'medium').maxHours)
    expect(chore.maxHours).toBeLessThan(baselineRange('feature', 'medium').maxHours)
  })

  it('ScalesWithComplexity', () => {
    expect(baselineRange('feature', 'trivial').maxHours).toBeLessThan(
      baselineRange('feature', 'xlarge').minHours,
    )
  })
})

describe('rangeMidpoint', () => {
  it('IsTheAverageOfTheBounds', () => {
    expect(rangeMidpoint({ minHours: 3, maxHours: 8 })).toBe(5.5)
  })
})

describe('resolveEstimate', () => {
  it('WithoutUserEstimate_UsesBaselineProvenanceAndMidpoint', () => {
    const r = resolveEstimate('feature', 'medium')
    expect(r.provenance).toBe('baseline')
    expect(r.userHours).toBeNull()
    expect(r.effectiveHours).toBe(5.5)
  })

  it('UserEstimateWins_withUserProvenance', () => {
    const r = resolveEstimate('feature', 'medium', 6)
    expect(r.provenance).toBe('user')
    expect(r.userHours).toBe(6)
    expect(r.effectiveHours).toBe(6)
    expect(r.baseline).toEqual({ minHours: 3, maxHours: 8 }) // baseline still carried for context
  })

  it('InvalidUserEstimate_IsIgnored', () => {
    expect(resolveEstimate('feature', 'medium', -2).provenance).toBe('baseline')
    expect(resolveEstimate('feature', 'medium', Number.NaN).provenance).toBe('baseline')
  })
})

describe('estimateVsActual', () => {
  it('OverEstimate_ReadsOver', () => {
    const r = estimateVsActual(5, 8)
    expect(r.deltaHours).toBe(3)
    expect(r.variancePct).toBe(60)
    expect(r.status).toBe('over')
  })

  it('WithinTolerance_ReadsOn', () => {
    // 5 % delta inside the default 10 % band.
    expect(estimateVsActual(10, 10.5).status).toBe('on')
  })

  it('UnderEstimate_ReadsUnder', () => {
    expect(estimateVsActual(10, 5).status).toBe('under')
  })

  it('ZeroEstimate_HasNullPercent_statusBySign', () => {
    expect(estimateVsActual(0, 3).variancePct).toBeNull()
    expect(estimateVsActual(0, 3).status).toBe('over')
    expect(estimateVsActual(0, 0).status).toBe('on')
  })
})
