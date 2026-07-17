import { describe, expect, it } from 'vitest'
import { HOUR_MS } from '../tracking/time.js'
import { overtimeForecast, type OvertimeWeek } from './overtime-forecast.js'

/**
 * Acceptance for overtime compound (REQ-049, design v13 G3). Weekly deltas fold into a
 * running balance; a straight line over that balance yields the trend, forecast, and a
 * deterministic pattern note.
 */
const week = (i: number, hours: number): OvertimeWeek => ({
  weekStartMs: i * 7 * 24 * HOUR_MS,
  deltaMs: Math.round(hours * HOUR_MS),
})

describe('overtimeForecast', () => {
  it('CompoundsWeeklyDeltasIntoARunningBalance', () => {
    const f = overtimeForecast([week(0, 1), week(1, 2), week(2, 1)])
    expect(f.series.map(p => p.balanceMs)).toEqual([1 * HOUR_MS, 3 * HOUR_MS, 4 * HOUR_MS])
    expect(f.currentMs).toBe(4 * HOUR_MS)
  })

  it('ProjectsForwardWhenOvertimeAccumulates', () => {
    // Steady +2h/week → balance 2,4,6,8; slope ≈ 2h/week; 4 weeks out ≈ 8 + 8 = 16h.
    const f = overtimeForecast([week(0, 2), week(1, 2), week(2, 2), week(3, 2)], {
      horizonWeeks: 4,
    })
    expect(f.trend).toBe('accumulating')
    expect(f.slopePerWeekMs).toBeCloseTo(2 * HOUR_MS, -5)
    expect(f.projectedMs).toBeGreaterThan(f.currentMs)
    expect(f.note).toContain('compounding')
  })

  it('ReadsAReducingBalanceWhenOvertimeIsPaidDown', () => {
    // Balance climbs then falls back: net downward slope.
    const f = overtimeForecast([week(0, 4), week(1, -1), week(2, -2), week(3, -3)])
    expect(f.trend).toBe('reducing')
    expect(f.note).toContain('paying')
  })

  it('CallsANearFlatBalanceStable', () => {
    const f = overtimeForecast([week(0, 0.1), week(1, -0.1), week(2, 0.1), week(3, -0.1)])
    expect(f.trend).toBe('stable')
    expect(f.note).toContain('steady')
  })

  it('IsHonestWithTooFewWeeks', () => {
    const empty = overtimeForecast([])
    expect(empty.currentMs).toBe(0)
    expect(empty.series).toEqual([])
    expect(overtimeForecast([week(0, 3)]).note).toContain('Not enough weeks')
  })
})
