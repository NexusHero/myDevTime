import { describe, expect, it } from 'vitest'
import { fetchSummary, parseSummary, toReportProjects } from './reports.js'

/**
 * The reports client reads the `/api/tracking/summary` response and joins the
 * per-project buckets (keyed by id) with human project names from the catalog.
 * These pin the DTO parse, the request path, and the name-join (including the
 * synthetic "No project" bucket and the fallback to the raw id).
 */
const SUMMARY = {
  totalMs: 9_000_000,
  billableMs: 6_000_000,
  days: ['2026-07-06', '2026-07-07'],
  byProject: [
    { projectId: 'p1', spentMs: 6_000_000, billableMs: 6_000_000, daily: [3_600_000, 2_400_000] },
    { projectId: '(none)', spentMs: 3_000_000, billableMs: 0, daily: [0, 3_000_000] },
  ],
}

describe('parseSummary', () => {
  it('ReadsTotalsDaysAndProjects', () => {
    const s = parseSummary(SUMMARY)
    expect(s.totalMs).toBe(9_000_000)
    expect(s.days).toEqual(['2026-07-06', '2026-07-07'])
    expect(s.byProject[0]?.daily).toEqual([3_600_000, 2_400_000])
  })
  it('MalformedPayload_Throws', () => {
    expect(() => parseSummary({ totalMs: 'x' })).toThrow()
    expect(() => parseSummary(null)).toThrow()
  })
})

describe('fetchSummary', () => {
  it('GetsSummaryWithRangeQuery', async () => {
    const seen: string[] = []
    const fetchImpl = ((url: string) => {
      seen.push(url)
      return Promise.resolve(new Response(JSON.stringify(SUMMARY), { status: 200 }))
    }) as unknown as typeof fetch
    const s = await fetchSummary(
      'http://api',
      { from: '2026-07-06T00:00:00.000Z', to: '2026-07-08T00:00:00.000Z', tz: 'UTC' },
      fetchImpl,
    )
    expect(s.totalMs).toBe(9_000_000)
    expect(seen[0]).toContain('/api/tracking/summary?')
    expect(seen[0]).toContain('tz=UTC')
  })
})

describe('toReportProjects', () => {
  it('JoinsNamesAndKeepsDailySeries', () => {
    const rows = toReportProjects(parseSummary(SUMMARY), new Map([['p1', 'Finanzo']]))
    expect(rows[0]).toEqual({
      id: 'p1',
      name: 'Finanzo',
      spentMs: 6_000_000,
      daily: [3_600_000, 2_400_000],
    })
    expect(rows[1]?.name).toBe('No project') // the "(none)" bucket
  })
  it('UnknownId_FallsBackToTheId', () => {
    const rows = toReportProjects(parseSummary(SUMMARY), new Map())
    expect(rows[0]?.name).toBe('p1')
  })
})
