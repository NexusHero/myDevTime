import { describe, expect, it } from 'vitest'
import { applicableRules, rateForEntry, type ScopedRateRule } from './pricing.js'

const T0 = Date.parse('2026-01-01T00:00:00.000Z')

const ws = (amount: number, from = T0): ScopedRateRule => ({
  level: 'workspace',
  scopeId: null,
  amountMinorPerHour: amount,
  effectiveFrom: from,
})
const project = (id: string, amount: number, from = T0): ScopedRateRule => ({
  level: 'project',
  scopeId: id,
  amountMinorPerHour: amount,
  effectiveFrom: from,
})
const task = (id: string, amount: number, from = T0): ScopedRateRule => ({
  level: 'task',
  scopeId: id,
  amountMinorPerHour: amount,
  effectiveFrom: from,
})
const client = (id: string, amount: number, from = T0): ScopedRateRule => ({
  level: 'client',
  scopeId: id,
  amountMinorPerHour: amount,
  effectiveFrom: from,
})

const SCOPE = { projectId: 'p1', clientId: 'c1', taskId: 't1' }

describe('rate applicability + selection', () => {
  it('ApplicableRules_KeepsOnlyThisEntrysChain', () => {
    const rules = [
      ws(1000),
      client('c1', 2000),
      client('c2', 9999), // other client — excluded
      project('p1', 3000),
      project('p2', 9999), // other project — excluded
      task('t1', 4000),
      task('t2', 9999), // other task — excluded
    ]
    const kept = applicableRules(rules, SCOPE)
    expect(kept.map(r => r.amountMinorPerHour).sort((a, b) => a - b)).toEqual([
      1000, 2000, 3000, 4000,
    ])
  })

  it('RateForEntry_PrefersMostSpecificLevel', () => {
    const rules = [ws(1000), client('c1', 2000), project('p1', 3000), task('t1', 4000)]
    expect(rateForEntry(rules, SCOPE, T0)).toBe(4000) // task wins
    expect(rateForEntry([ws(1000), project('p1', 3000)], SCOPE, T0)).toBe(3000) // project wins
    expect(rateForEntry([ws(1000), client('c1', 2000)], SCOPE, T0)).toBe(2000) // client wins
    expect(rateForEntry([ws(1000)], SCOPE, T0)).toBe(1000) // workspace default
  })

  it('RateForEntry_ReturnsNull_WhenNothingInEffect', () => {
    expect(rateForEntry([], SCOPE, T0)).toBeNull()
    // A project rate that becomes effective tomorrow does not price today's entry.
    const tomorrow = T0 + 24 * 3_600_000
    expect(rateForEntry([project('p1', 3000, tomorrow)], SCOPE, T0)).toBeNull()
  })

  it('RateForEntry_IsEffectiveDated_NonRetroactively', () => {
    const day = 24 * 3_600_000
    const rules = [project('p1', 3000, T0), project('p1', 5000, T0 + 10 * day)]
    expect(rateForEntry(rules, SCOPE, T0 + 5 * day)).toBe(3000) // old rate still in effect
    expect(rateForEntry(rules, SCOPE, T0 + 12 * day)).toBe(5000) // new rate applies after its date
  })

  it('RateForEntry_UsesWorkspaceDefault_ForUnassignedEntry', () => {
    const unassigned = { projectId: null, clientId: null, taskId: null }
    expect(rateForEntry([ws(1000), project('p1', 3000)], unassigned, T0)).toBe(1000)
  })
})
