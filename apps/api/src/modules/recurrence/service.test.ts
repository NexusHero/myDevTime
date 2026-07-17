import { describe, expect, it } from 'vitest'
import { rowToRule, seriesToOccurrences, type SeriesRow } from './service.js'

/**
 * The pure heart of the recurrence endpoint (REQ-060, design v17 §F4): `rowToRule` rebuilds the
 * deterministic rule from stored columns and `seriesToOccurrences` projects every series over a
 * window — verified here without a database (the DB CRUD is covered by the integration test).
 */
function row(over: Partial<SeriesRow>): SeriesRow {
  return {
    id: 'series-1',
    workspaceId: 'ws-1',
    userId: 'u-1',
    kind: 'focus',
    title: 'Standup',
    anchorDate: '2026-07-06', // a Monday
    startMin: 540,
    lenMin: 30,
    freq: 'weekly',
    endKind: 'never',
    untilDate: null,
    count: null,
    projectId: null,
    createdAt: new Date(0),
    ...over,
  }
}

describe('rowToRule', () => {
  it('NeverEnd_WhenBoundsAreNull', () => {
    expect(rowToRule({ freq: 'weekly', endKind: 'never', untilDate: null, count: null })).toEqual({
      freq: 'weekly',
      end: { kind: 'never' },
    })
  })

  it('CountAndUntil_MapFromTheirColumns', () => {
    expect(rowToRule({ freq: 'daily', endKind: 'count', untilDate: null, count: 5 }).end).toEqual({
      kind: 'count',
      count: 5,
    })
    expect(
      rowToRule({ freq: 'weekly', endKind: 'until', untilDate: '2026-08-01', count: null }).end,
    ).toEqual({ kind: 'until', date: '2026-08-01' })
  })
})

describe('seriesToOccurrences', () => {
  it('ProjectsAWeeklySeriesAcrossTheWindow', () => {
    const occ = seriesToOccurrences([row({})], '2026-07-06', '2026-07-27')
    expect(occ.map(o => o.date)).toEqual(['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27'])
    expect(occ[0]).toMatchObject({
      seriesId: 'series-1',
      title: 'Standup',
      startMin: 540,
      lenMin: 30,
    })
  })

  it('RespectsACountBound', () => {
    const occ = seriesToOccurrences(
      [row({ freq: 'weekly', endKind: 'count', count: 2 })],
      '2026-07-06',
      '2026-08-31',
    )
    expect(occ.map(o => o.date)).toEqual(['2026-07-06', '2026-07-13'])
  })

  it('MergesAndSortsMultipleSeriesByDateThenStart', () => {
    const a = row({ id: 'a', anchorDate: '2026-07-06', freq: 'weekly', startMin: 600 })
    const b = row({ id: 'b', anchorDate: '2026-07-13', freq: 'weekly', startMin: 540 })
    const occ = seriesToOccurrences([a, b], '2026-07-06', '2026-07-13')
    // 07-06 (a only), then 07-13 with b (540) before a (600).
    expect(occ.map(o => `${o.date}#${String(o.startMin)}`)).toEqual([
      '2026-07-06#600',
      '2026-07-13#540',
      '2026-07-13#600',
    ])
  })

  it('EmptyWhenTheWindowPredatesTheSeries', () => {
    expect(seriesToOccurrences([row({})], '2026-01-01', '2026-06-30')).toEqual([])
  })
})
