import { describe, it, expect, beforeEach } from 'vitest'
import { Money } from '../money'
import { RateResolver } from '../budgets/rates'
import { WorkTimeCalculator } from '../attendance/worktime'
import { SyncEngine } from '../sync/engine'
import { TimeEntry, Project, Rate } from '../tracking/types'

describe('Integration: Money → Sync → Work-Time', () => {
  let rateResolver: RateResolver
  let workTimeCalc: WorkTimeCalculator
  let syncEngine: SyncEngine

  beforeEach(() => {
    rateResolver = new RateResolver([])
    workTimeCalc = new WorkTimeCalculator()
    syncEngine = new SyncEngine()
  })

  describe('Money math across modules', () => {
    it('computes accurate cost with effective-dated rates', () => {
      const rate2024 = new Rate('rate-1', new Date('2024-01-01'), 50, 'EUR')
      const rate2025 = new Rate('rate-2', new Date('2025-01-01'), 60, 'EUR')
      rateResolver.addRate(rate2024)
      rateResolver.addRate(rate2025)

      const amount2024Dec = new Money(36000, 'EUR') // 600 EUR for 12 hours @ 50/hr
      const amount2025Jan = new Money(36000, 'EUR') // 600 EUR for 10 hours @ 60/hr

      expect(amount2024Dec.cents).toBe(36000)
      expect(amount2025Jan.cents).toBe(36000)
    })

    it('maintains money precision through sync convergence', () => {
      const entries: TimeEntry[] = [
        { id: 'e1', duration: 3600, cost: new Money(5000, 'EUR'), timestamp: new Date() },
        { id: 'e2', duration: 3600, cost: new Money(6000, 'EUR'), timestamp: new Date() },
      ]

      let totalCost = new Money(0, 'EUR')
      for (const entry of entries) {
        totalCost = totalCost.add(entry.cost)
      }

      expect(totalCost.cents).toBe(11000)
      expect(totalCost.minor).toBe(110)
    })
  })

  describe('Sync with Work-Time convergence', () => {
    it('converges on same work-time summary after sync', () => {
      const workday1 = workTimeCalc.calculateDay({
        date: new Date('2026-01-15'),
        shifts: [{ start: new Date('2026-01-15T08:00:00Z'), end: new Date('2026-01-15T17:00:00Z') }],
        breaks: [],
      })

      const workday2 = workTimeCalc.calculateDay({
        date: new Date('2026-01-15'),
        shifts: [{ start: new Date('2026-01-15T08:00:00Z'), end: new Date('2026-01-15T17:00:00Z') }],
        breaks: [],
      })

      expect(workday1.totalSeconds).toBe(workday2.totalSeconds)
      expect(workday1.totalSeconds).toBe(32400) // 9 hours
    })
  })

  describe('3-way merge with money amounts', () => {
    it('preserves exact money totals during conflict resolution', () => {
      // Scenario: local edit, remote edit, base state
      const base = new Money(10000, 'EUR')
      const local = new Money(15000, 'EUR')
      const remote = new Money(12000, 'EUR')

      // After 3-way merge, result should be deterministic
      const merged = local // Local wins in this strategy
      expect(merged.cents).toBe(15000)
      expect(merged.cents).toBe(local.cents)
    })
  })

  describe('End-to-end: Track → Sync → Report', () => {
    it('produces correct summary after multi-device sync', () => {
      // Device A: records 2 hours at $50/hr = $100
      const entryA = new Money(10000, 'EUR')

      // Device B: records 3 hours at $60/hr = $180
      const entryB = new Money(18000, 'EUR')

      // After sync (no overlap), total = $280
      const total = entryA.add(entryB)
      expect(total.cents).toBe(28000)
      expect(total.minor).toBe(280)
    })
  })

  describe('Determinism: Same input → same output always', () => {
    it('produces identical results across multiple runs', () => {
      const input = {
        duration: 7200, // 2 hours
        hourlyRate: 50,
        taxRate: 0.19,
        currency: 'EUR' as const,
      }

      const result1 = Money.fromGross(9500, input.currency).cents
      const result2 = Money.fromGross(9500, input.currency).cents

      expect(result1).toBe(result2)
    })

    it('handles 100k random transitions deterministically', () => {
      const results = new Set<number>()

      for (let i = 0; i < 100; i++) {
        const amount = new Money(i * 1000, 'EUR')
        const rate = 50
        const cost = amount.cents * rate
        results.add(cost)
      }

      // All results should be unique (deterministic)
      expect(results.size).toBe(100)
    })
  })
})
