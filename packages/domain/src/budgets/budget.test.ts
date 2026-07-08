import { describe, expect, it } from 'vitest'
import {
  budgetStatus,
  consumedDuration,
  deadlineStatus,
  evaluateThresholds,
  isDueWithin,
  type Budget,
} from './budget.js'
import { DAY_MS, HOUR_MS } from '../tracking/time.js'

const moneyBudget = (limit: number, thresholds = [0.8, 1]): Budget => ({
  basis: 'money',
  limit,
  period: 'total',
  thresholds,
})

describe('budgetStatus', () => {
  it('BudgetStatus_UnderBudget_ComputesRatioAndRemaining', () => {
    const s = budgetStatus(moneyBudget(100_00), 60_00)
    expect(s.ratio).toBeCloseTo(0.6)
    expect(s.remaining).toBe(40_00)
    expect(s.reached).toEqual([])
  })

  it('BudgetStatus_OverBudget_RemainingGoesNegative_AllThresholdsReached', () => {
    const s = budgetStatus(moneyBudget(100_00), 130_00)
    expect(s.remaining).toBe(-30_00)
    expect(s.reached).toEqual([0.8, 1])
  })

  it('BudgetStatus_ZeroLimit_NeverAlerts', () => {
    const s = budgetStatus(moneyBudget(0), 5_00)
    expect(s.ratio).toBe(0)
    expect(s.reached).toEqual([])
  })

  it('BudgetStatus_HoursBasis_UsesMilliseconds', () => {
    const budget: Budget = {
      basis: 'hours',
      limit: 10 * HOUR_MS,
      period: 'total',
      thresholds: [0.8],
    }
    const s = budgetStatus(budget, consumedDuration([4 * HOUR_MS, 5 * HOUR_MS]))
    expect(s.ratio).toBeCloseTo(0.9)
    expect(s.reached).toEqual([0.8])
  })
})

describe('evaluateThresholds', () => {
  it('EvaluateThresholds_NewlyCrossed_Fires', () => {
    const r = evaluateThresholds([0.8, 1], 0.85, [])
    expect(r.toFire).toEqual([0.8])
    expect(r.fired).toEqual([0.8])
  })

  it('EvaluateThresholds_AlreadyFired_DoesNotRefire', () => {
    const r = evaluateThresholds([0.8, 1], 0.9, [0.8])
    expect(r.toFire).toEqual([])
    expect(r.fired).toEqual([0.8])
  })

  it('EvaluateThresholds_HoveringAtThreshold_DoesNotFlap', () => {
    // Fired at 0.80, now dipped to 0.79 — still within hysteresis, stays fired.
    const r = evaluateThresholds([0.8], 0.79, [0.8], 0.05)
    expect(r.toFire).toEqual([])
    expect(r.toClear).toEqual([])
    expect(r.fired).toEqual([0.8])
  })

  it('EvaluateThresholds_DropsBelowHysteresis_ClearsSoItCanFireAgain', () => {
    const r = evaluateThresholds([0.8], 0.7, [0.8], 0.05)
    expect(r.toClear).toEqual([0.8])
    expect(r.fired).toEqual([])
  })

  it('EvaluateThresholds_CrossesMultiple_FiresAll', () => {
    const r = evaluateThresholds([0.5, 0.8, 1], 1.2, [])
    expect(r.toFire).toEqual([0.5, 0.8, 1])
  })

  it('EvaluateThresholds_ClearsMultiple_ReturnsSortedAndEmptiesFired', () => {
    const r = evaluateThresholds([0.8, 1], 0.2, [1, 0.8], 0.05)
    expect(r.toClear).toEqual([0.8, 1])
    expect(r.fired).toEqual([])
  })
})

describe('deadlineStatus', () => {
  const now = Date.parse('2026-07-08T12:00:00Z')

  it('DeadlineStatus_FutureDeadline_CountsWholeDaysRemaining', () => {
    const s = deadlineStatus(now + 2 * DAY_MS + HOUR_MS, now)
    expect(s.overdue).toBe(false)
    expect(s.daysRemaining).toBe(3) // 2d1h → ceil
  })

  it('DeadlineStatus_PastDeadline_IsOverdue', () => {
    const s = deadlineStatus(now - DAY_MS, now)
    expect(s.overdue).toBe(true)
    expect(s.daysRemaining).toBeLessThan(0)
  })

  it('IsDueWithin_InsideWindow_IsTrue_OverdueIsFalse', () => {
    expect(isDueWithin(now + 2 * DAY_MS, now, 3)).toBe(true)
    expect(isDueWithin(now + 5 * DAY_MS, now, 3)).toBe(false)
    expect(isDueWithin(now - DAY_MS, now, 3)).toBe(false)
  })
})
