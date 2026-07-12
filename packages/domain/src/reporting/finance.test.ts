import { describe, expect, it } from 'vitest'
import { budgetConsumptions, priceBillableEntries, type BudgetLimit } from './finance.js'
import type { ScopedRateRule } from '../budgets/pricing.js'
import type { TimeEntry } from '../tracking/time-entry.js'

const T0 = Date.parse('2026-01-01T00:00:00.000Z')
const HOUR = 3_600_000
const ASOF = T0 + 100 * HOUR

/** A completed entry starting at `T0 + startH` hours, lasting `hours`. */
function entry(
  id: string,
  startH: number,
  hours: number,
  extra: Partial<TimeEntry> = {},
): TimeEntry {
  return {
    id,
    start: T0 + startH * HOUR,
    end: T0 + (startH + hours) * HOUR,
    billable: true,
    source: 'timer',
    ...extra,
  }
}

const RATES: ScopedRateRule[] = [
  { level: 'workspace', scopeId: null, amountMinorPerHour: 5000, effectiveFrom: T0 }, // €50/h default
  { level: 'project', scopeId: 'p1', amountMinorPerHour: 8000, effectiveFrom: T0 }, // €80/h on p1
]
const CLIENT_BY_PROJECT = new Map<string, string | null>([
  ['p1', 'c1'],
  ['p2', null],
])

describe('priceBillableEntries', () => {
  it('PricesEachEntry_AtItsProjectsRate_AndSumsPerProject', () => {
    const entries = [
      entry('a', 0, 2, { projectId: 'p1' }), // 2h @ €80 = 16000
      entry('b', 3, 1, { projectId: 'p1' }), // 1h @ €80 = 8000
      entry('c', 5, 4, { projectId: 'p2' }), // 4h @ €50 (default) = 20000
    ]
    const result = priceBillableEntries(entries, CLIENT_BY_PROJECT, RATES, ASOF)
    // Most-billed first: p1 (24000) outranks p2 (20000).
    expect(result.byProject).toEqual([
      { projectId: 'p1', costMinor: 24000 },
      { projectId: 'p2', costMinor: 20000 },
    ])
    expect(result.billableMinor).toBe(44000)
  })

  it('SkipsNonBillable_Unassigned_AndUnpricedEntries', () => {
    const entries = [
      entry('nb', 0, 2, { projectId: 'p1', billable: false }), // not billable
      entry('un', 3, 2), // no project
      entry('np', 5, 2, { projectId: 'p9' }), // p9 has no rate in effect
    ]
    const noDefault: ScopedRateRule[] = [
      { level: 'project', scopeId: 'p1', amountMinorPerHour: 8000, effectiveFrom: T0 },
    ]
    const result = priceBillableEntries(entries, CLIENT_BY_PROJECT, noDefault, ASOF)
    expect(result.billableMinor).toBe(0)
    expect(result.byProject).toEqual([])
  })

  it('MeasuresARunningEntry_ToAsOf', () => {
    const running: TimeEntry = {
      id: 'r',
      start: ASOF - 2 * HOUR,
      end: null,
      billable: true,
      source: 'timer',
      projectId: 'p1',
    }
    const result = priceBillableEntries([running], CLIENT_BY_PROJECT, RATES, ASOF)
    expect(result.billableMinor).toBe(16000) // 2h @ €80
  })
})

describe('budgetConsumptions', () => {
  const hoursBudget: BudgetLimit = {
    id: 'b-hours',
    scope: 'project',
    scopeId: 'p1',
    basis: 'hours',
    limit: 10 * HOUR, // 10h cap
    period: 'total',
    thresholds: [0.8, 1],
  }
  const moneyBudget: BudgetLimit = {
    id: 'b-money',
    scope: 'project',
    scopeId: 'p1',
    basis: 'money',
    limit: 100000, // €1000 cap
    period: 'total',
    thresholds: [0.8, 1],
  }

  it('HoursBudget_SumsAllProjectDurations_IncludingNonBillable', () => {
    const entries = [
      entry('a', 0, 5, { projectId: 'p1' }),
      entry('b', 6, 4, { projectId: 'p1', billable: false }), // still counts for hours
      entry('c', 20, 3, { projectId: 'p2' }), // other project — excluded
    ]
    const [c] = budgetConsumptions([hoursBudget], entries, CLIENT_BY_PROJECT, RATES, ASOF)
    expect(c?.status.consumed).toBe(9 * HOUR)
    expect(c?.status.ratio).toBeCloseTo(0.9)
    expect(c?.status.reached).toEqual([0.8])
  })

  it('MoneyBudget_PricesAllProjectEntries_RegardlessOfBillable', () => {
    const entries = [
      entry('a', 0, 5, { projectId: 'p1' }), // 5h @ €80 = 40000
      entry('b', 6, 5, { projectId: 'p1', billable: false }), // 5h @ €80 = 40000 (money counts it)
    ]
    const [c] = budgetConsumptions([moneyBudget], entries, CLIENT_BY_PROJECT, RATES, ASOF)
    expect(c?.status.consumed).toBe(80000)
    expect(c?.status.ratio).toBeCloseTo(0.8)
  })

  it('NonProjectScope_ConsumesZero', () => {
    const clientBudget: BudgetLimit = { ...moneyBudget, scope: 'client', scopeId: 'c1' }
    const entries = [entry('a', 0, 5, { projectId: 'p1' })]
    const [c] = budgetConsumptions([clientBudget], entries, CLIENT_BY_PROJECT, RATES, ASOF)
    expect(c?.status.consumed).toBe(0)
  })
})
