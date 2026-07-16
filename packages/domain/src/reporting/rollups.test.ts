import { describe, expect, it } from 'vitest'
import { agingBuckets, effectiveRateMinorPerHour, revenueByClient } from './rollups.js'

const DAY = 86_400_000
const H = 3_600_000

describe('revenueByClient', () => {
  it('RollsProjectCostsUpToTheirClient_MostRevenueFirst', () => {
    const byProject = [
      { projectId: 'p1', costMinor: 3000 },
      { projectId: 'p2', costMinor: 2000 },
      { projectId: 'p3', costMinor: 5000 },
    ]
    const clientByProject = new Map<string, string | null>([
      ['p1', 'c1'],
      ['p2', 'c1'],
      ['p3', 'c2'],
    ])
    expect(revenueByClient(byProject, clientByProject)).toEqual([
      { clientId: 'c1', minor: 5000 },
      { clientId: 'c2', minor: 5000 },
    ])
  })

  it('UnmappedProject_FoldsIntoTheInternalNullBucket', () => {
    const byProject = [{ projectId: 'p9', costMinor: 700 }]
    expect(revenueByClient(byProject, new Map())).toEqual([{ clientId: null, minor: 700 }])
  })
})

describe('effectiveRateMinorPerHour', () => {
  it('DividesBillableMoneyByBillableHours', () => {
    // 15 600 minor over 2h → 7 800 minor/h.
    expect(effectiveRateMinorPerHour(15_600, 2 * H)).toBe(7_800)
  })

  it('NoBillableTime_IsNull', () => {
    expect(effectiveRateMinorPerHour(0, 0)).toBeNull()
  })
})

describe('agingBuckets', () => {
  const asOf = Date.parse('2026-07-16T00:00:00Z')
  const item = (ageDays: number, amountMinor: number, durationMs = H) => ({
    startMs: asOf - ageDays * DAY,
    amountMinor,
    durationMs,
  })

  it('BucketsOpenAmountsByAge_RecentMidOld', () => {
    const report = agingBuckets([item(5, 1000), item(20, 240), item(45, 520), item(80, 220)], asOf)
    expect(report.buckets).toEqual([
      { key: 'recent', minor: 1240, ms: 2 * H },
      { key: 'mid', minor: 520, ms: H },
      { key: 'old', minor: 220, ms: H },
    ])
    expect(report.totalMinor).toBe(1980)
    expect(report.totalMs).toBe(4 * H)
  })

  it('BoundariesAreInclusiveOnTheLowerBucket', () => {
    // exactly 30 days → recent; exactly 60 days → mid.
    const report = agingBuckets([item(30, 100), item(60, 200)], asOf)
    expect(report.buckets[0]).toEqual({ key: 'recent', minor: 100, ms: H })
    expect(report.buckets[1]).toEqual({ key: 'mid', minor: 200, ms: H })
  })

  it('EmptyInput_IsAllZeroBuckets', () => {
    const report = agingBuckets([], asOf)
    expect(report.totalMinor).toBe(0)
    expect(report.buckets.map(b => b.minor)).toEqual([0, 0, 0])
  })
})
