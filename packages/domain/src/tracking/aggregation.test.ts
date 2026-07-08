import { describe, expect, it } from 'vitest'
import { aggregate } from './aggregation.js'
import type { TimeEntry } from './time-entry.js'
import { HOUR_MS, zonedTimeToInstant } from './time.js'

const BERLIN = 'Europe/Berlin'

function at(y: number, m: number, d: number, h: number, min = 0): number {
  return zonedTimeToInstant({ year: y, month: m, day: d, hour: h, minute: min, second: 0 }, BERLIN)
}

function entry(
  id: string,
  start: number,
  end: number | null,
  extra: Partial<TimeEntry> = {},
): TimeEntry {
  return { id, start, end, billable: true, source: 'timer', ...extra }
}

describe('aggregate — day', () => {
  it('Aggregate_TwoEntriesSameDay_SumsTotal', () => {
    const entries = [
      entry('a', at(2026, 7, 15, 9), at(2026, 7, 15, 11)),
      entry('b', at(2026, 7, 15, 13), at(2026, 7, 15, 14)),
    ]

    expect(aggregate(entries, { tz: BERLIN, granularity: 'day' })).toEqual([
      {
        period: '2026-07-15',
        group: null,
        totalMs: 3 * HOUR_MS,
        billableMs: 3 * HOUR_MS,
        nonBillableMs: 0,
      },
    ])
  })

  it('Aggregate_MidnightSpanning_SplitsAcrossDays', () => {
    const entries = [entry('a', at(2026, 7, 15, 23), at(2026, 7, 16, 1))]

    expect(aggregate(entries, { tz: BERLIN, granularity: 'day' })).toEqual([
      {
        period: '2026-07-15',
        group: null,
        totalMs: HOUR_MS,
        billableMs: HOUR_MS,
        nonBillableMs: 0,
      },
      {
        period: '2026-07-16',
        group: null,
        totalMs: HOUR_MS,
        billableMs: HOUR_MS,
        nonBillableMs: 0,
      },
    ])
  })

  it('Aggregate_BillableSplit_SeparatesSums', () => {
    const entries = [
      entry('a', at(2026, 7, 15, 9), at(2026, 7, 15, 10)),
      entry('b', at(2026, 7, 15, 10), at(2026, 7, 15, 12), { billable: false }),
    ]

    expect(aggregate(entries, { tz: BERLIN, granularity: 'day' })[0]).toMatchObject({
      billableMs: HOUR_MS,
      nonBillableMs: 2 * HOUR_MS,
      totalMs: 3 * HOUR_MS,
    })
  })
})

describe('aggregate — week & month', () => {
  it('Aggregate_Week_BucketsByWeekStart', () => {
    const entries = [
      entry('a', at(2026, 7, 13, 9), at(2026, 7, 13, 10)),
      entry('b', at(2026, 7, 16, 9), at(2026, 7, 16, 11)),
    ]

    expect(aggregate(entries, { tz: BERLIN, granularity: 'week' })).toEqual([
      {
        period: '2026-07-13',
        group: null,
        totalMs: 3 * HOUR_MS,
        billableMs: 3 * HOUR_MS,
        nonBillableMs: 0,
      },
    ])
  })

  it('Aggregate_Month_BucketsByYearMonth', () => {
    const entries = [
      entry('a', at(2026, 7, 3, 9), at(2026, 7, 3, 10)),
      entry('b', at(2026, 7, 28, 9), at(2026, 7, 28, 10)),
    ]

    expect(aggregate(entries, { tz: BERLIN, granularity: 'month' })).toEqual([
      {
        period: '2026-07',
        group: null,
        totalMs: 2 * HOUR_MS,
        billableMs: 2 * HOUR_MS,
        nonBillableMs: 0,
      },
    ])
  })
})

describe('aggregate — groupBy', () => {
  it('Aggregate_GroupByProject_SeparatesBuckets', () => {
    const entries = [
      entry('a', at(2026, 7, 15, 9), at(2026, 7, 15, 10), { projectId: 'p1' }),
      entry('b', at(2026, 7, 15, 10), at(2026, 7, 15, 12), { projectId: 'p2' }),
    ]

    expect(aggregate(entries, { tz: BERLIN, granularity: 'day', groupBy: 'project' })).toEqual([
      {
        period: '2026-07-15',
        group: 'p1',
        totalMs: HOUR_MS,
        billableMs: HOUR_MS,
        nonBillableMs: 0,
      },
      {
        period: '2026-07-15',
        group: 'p2',
        totalMs: 2 * HOUR_MS,
        billableMs: 2 * HOUR_MS,
        nonBillableMs: 0,
      },
    ])
  })

  it('Aggregate_GroupByTag_MultiTagCountsInEach', () => {
    const entries = [entry('a', at(2026, 7, 15, 9), at(2026, 7, 15, 10), { tags: ['x', 'y'] })]

    expect(aggregate(entries, { tz: BERLIN, granularity: 'day', groupBy: 'tag' })).toEqual([
      { period: '2026-07-15', group: 'x', totalMs: HOUR_MS, billableMs: HOUR_MS, nonBillableMs: 0 },
      { period: '2026-07-15', group: 'y', totalMs: HOUR_MS, billableMs: HOUR_MS, nonBillableMs: 0 },
    ])
  })

  it('Aggregate_GroupByTask_SeparatesBuckets', () => {
    const entries = [
      entry('a', at(2026, 7, 15, 9), at(2026, 7, 15, 10), { taskId: 't1' }),
      entry('b', at(2026, 7, 15, 10), at(2026, 7, 15, 11), { taskId: 't2' }),
    ]

    expect(
      aggregate(entries, { tz: BERLIN, granularity: 'day', groupBy: 'task' }).map(b => b.group),
    ).toEqual(['t1', 't2'])
  })

  it('Aggregate_GroupByClient_SeparatesBuckets', () => {
    const entries = [entry('a', at(2026, 7, 15, 9), at(2026, 7, 15, 10), { clientId: 'c1' })]

    expect(
      aggregate(entries, { tz: BERLIN, granularity: 'day', groupBy: 'client' })[0]?.group,
    ).toBe('c1')
  })

  it('Aggregate_GroupByProjectMissing_UsesNonePlaceholder', () => {
    const entries = [entry('a', at(2026, 7, 15, 9), at(2026, 7, 15, 10))]

    expect(
      aggregate(entries, { tz: BERLIN, granularity: 'day', groupBy: 'project' })[0]?.group,
    ).toBe('(none)')
  })

  it('Aggregate_GroupByTagUntagged_UsesUntaggedPlaceholder', () => {
    const entries = [entry('a', at(2026, 7, 15, 9), at(2026, 7, 15, 10))]

    expect(aggregate(entries, { tz: BERLIN, granularity: 'day', groupBy: 'tag' })[0]?.group).toBe(
      '(untagged)',
    )
  })
})

describe('aggregate — rounding & running', () => {
  it('Aggregate_RoundingUp_AppliedPerBucket', () => {
    const start = at(2026, 7, 15, 9)
    const entries = [entry('a', start, start + 61_000)] // 61 seconds

    expect(
      aggregate(entries, {
        tz: BERLIN,
        granularity: 'day',
        rounding: { mode: 'up', incrementMinutes: 15 },
      })[0]?.totalMs,
    ).toBe(15 * 60_000)
  })

  it('Aggregate_RunningWithoutAsOf_Skipped', () => {
    const entries = [entry('a', at(2026, 7, 15, 9), null)]

    expect(aggregate(entries, { tz: BERLIN, granularity: 'day' })).toEqual([])
  })

  it('Aggregate_RunningWithAsOf_Measured', () => {
    const start = at(2026, 7, 15, 9)

    expect(
      aggregate([entry('a', start, null)], {
        tz: BERLIN,
        granularity: 'day',
        asOf: start + HOUR_MS,
      })[0]?.totalMs,
    ).toBe(HOUR_MS)
  })

  it('Aggregate_ZeroLengthEntry_Ignored', () => {
    const t = at(2026, 7, 15, 9)

    expect(aggregate([entry('a', t, t)], { tz: BERLIN, granularity: 'day' })).toEqual([])
  })
})

describe('aggregate — DST', () => {
  it('Aggregate_FullFallBackDay_Totals25Hours', () => {
    const start = at(2026, 10, 25, 0)
    const end = at(2026, 10, 26, 0)

    expect(aggregate([entry('a', start, end)], { tz: BERLIN, granularity: 'day' })).toEqual([
      {
        period: '2026-10-25',
        group: null,
        totalMs: 25 * HOUR_MS,
        billableMs: 25 * HOUR_MS,
        nonBillableMs: 0,
      },
    ])
  })
})
