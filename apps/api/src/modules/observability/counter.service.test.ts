import { describe, expect, it } from 'vitest'
import { CounterService, METRIC } from './counter.service.js'

/**
 * The in-process counter registry (REQ-021): seeded metrics start at 0, increments
 * accumulate (default and explicit step), and an unknown counter reads as 0 — never
 * undefined — so the metrics snapshot is always a complete set of numbers.
 */
describe('CounterService', () => {
  it('SeedsTheKnownMetricsAtZero', () => {
    const counters = new CounterService()
    for (const name of Object.values(METRIC)) {
      expect(counters.get(name)).toBe(0)
    }
  })

  it('UnknownCounterReadsAsZero', () => {
    const counters = new CounterService()
    expect(counters.get('never.seen')).toBe(0)
  })

  it('IncrementsByOneByDefault', () => {
    const counters = new CounterService()
    counters.increment(METRIC.requestsTotal)
    counters.increment(METRIC.requestsTotal)
    expect(counters.get(METRIC.requestsTotal)).toBe(2)
  })

  it('IncrementsByAnExplicitStep', () => {
    const counters = new CounterService()
    counters.increment(METRIC.aiCreditsSpent, 5)
    counters.increment(METRIC.aiCreditsSpent, 3)
    expect(counters.get(METRIC.aiCreditsSpent)).toBe(8)
  })

  it('CreatesAnUnseenCounterOnFirstIncrement', () => {
    const counters = new CounterService()
    counters.increment('custom.metric', 2)
    expect(counters.get('custom.metric')).toBe(2)
  })

  it('SnapshotReflectsEverySeededAndAdHocCounter', () => {
    const counters = new CounterService()
    counters.increment(METRIC.aiCalls, 4)
    counters.increment('custom.metric')
    const snap = counters.snapshot()
    expect(snap[METRIC.aiCalls]).toBe(4)
    expect(snap[METRIC.requestsTotal]).toBe(0)
    expect(snap['custom.metric']).toBe(1)
  })
})
