import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '../tracking/time-entry.js'
import { summarizeEntries } from './summary.js'

/**
 * `summarizeEntries` shapes raw entries into the workspace report the client
 * renders: workspace totals, a billable split, and per-project daily buckets
 * aligned to one ordered day axis. It builds on the exhaustively tested
 * `aggregate`, so these pin the shaping — day axis, per-project alignment,
 * billable totals, ordering, and the empty case.
 */
const H = 3_600_000
const M = 60_000

function entry(
  id: string,
  startISO: string,
  endISO: string | null,
  billable: boolean,
  projectId?: string,
): TimeEntry {
  return {
    id,
    start: Date.parse(startISO),
    end: endISO === null ? null : Date.parse(endISO),
    billable,
    source: 'timer',
    ...(projectId === undefined ? {} : { projectId }),
  }
}

const ENTRIES: readonly TimeEntry[] = [
  entry('a', '2026-07-06T09:00:00Z', '2026-07-06T11:00:00Z', true, 'p1'), // 2h Mon
  entry('b', '2026-07-07T10:00:00Z', '2026-07-07T10:30:00Z', false, 'p1'), // 0.5h Tue, non-billable
  entry('c', '2026-07-06T14:00:00Z', '2026-07-06T15:00:00Z', true, 'p2'), // 1h Mon
]

describe('summarizeEntries', () => {
  const s = summarizeEntries(ENTRIES, { tz: 'UTC' })

  it('WorkspaceTotals_SumTrackedAndBillable', () => {
    expect(s.totalMs).toBe(3 * H + 30 * M)
    expect(s.billableMs).toBe(3 * H) // b is non-billable
  })

  it('DayAxis_IsSortedDistinctDays', () => {
    expect(s.days).toEqual(['2026-07-06', '2026-07-07'])
  })

  it('PerProject_DailyAlignsToDayAxis', () => {
    const p1 = s.byProject.find(p => p.projectId === 'p1')
    expect(p1?.spentMs).toBe(2 * H + 30 * M)
    expect(p1?.billableMs).toBe(2 * H)
    expect(p1?.daily).toEqual([2 * H, 30 * M]) // Mon 2h, Tue 0.5h
    const p2 = s.byProject.find(p => p.projectId === 'p2')
    expect(p2?.daily).toEqual([1 * H, 0]) // Mon 1h, Tue nothing
  })

  it('ByProject_SortedBySpentDescending', () => {
    expect(s.byProject.map(p => p.projectId)).toEqual(['p1', 'p2'])
  })

  it('NoProjectEntries_LandInNoneBucket', () => {
    const only = summarizeEntries(
      [entry('x', '2026-07-06T08:00:00Z', '2026-07-06T09:00:00Z', true)],
      {
        tz: 'UTC',
      },
    )
    expect(only.byProject[0]?.projectId).toBe('(none)')
    expect(only.byProject[0]?.spentMs).toBe(1 * H)
  })

  it('NoEntries_IsAllEmpty', () => {
    expect(summarizeEntries([], { tz: 'UTC' })).toEqual({
      totalMs: 0,
      billableMs: 0,
      days: [],
      byProject: [],
    })
  })

  it('AsOf_CountsARunningEntryUpToThatInstant', () => {
    const running = entry('r', '2026-07-06T09:00:00Z', null, true, 'p1')
    const withAsOf = summarizeEntries([running], {
      tz: 'UTC',
      asOf: Date.parse('2026-07-06T10:30:00Z'),
    })
    expect(withAsOf.totalMs).toBe(90 * M)
    // Without asOf a running entry contributes nothing.
    expect(summarizeEntries([running], { tz: 'UTC' }).totalMs).toBe(0)
  })

  it('WeekStartsOn_IsForwardedWithoutChangingDailyOutput', () => {
    expect(summarizeEntries(ENTRIES, { tz: 'UTC', weekStartsOn: 7 })).toEqual(
      summarizeEntries(ENTRIES, { tz: 'UTC' }),
    )
  })

  it('EqualSpent_TieBreaksByProjectId', () => {
    const tie = summarizeEntries(
      [
        entry('a', '2026-07-06T09:00:00Z', '2026-07-06T10:00:00Z', true, 'zeta'),
        entry('b', '2026-07-06T09:00:00Z', '2026-07-06T10:00:00Z', true, 'alpha'),
      ],
      { tz: 'UTC' },
    )
    expect(tie.byProject.map(p => p.projectId)).toEqual(['alpha', 'zeta'])
  })
})
