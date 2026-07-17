import { describe, expect, it } from 'vitest'
import {
  createSeries,
  listOccurrences,
  parseOccurrence,
  parseSeries,
  truncateSeries,
} from './recurrence.js'

/**
 * The recurrence client (REQ-060, design v17 §F4): parses series rows + projected occurrences
 * from the NestJS `recurrence` module and posts new series. Exercised through an injected fetch
 * so no network is needed; the occurrence math is the server's deterministic core.
 */
const SERIES = {
  id: 's1',
  workspaceId: 'w1',
  userId: 'u1',
  kind: 'focus',
  title: 'Standup',
  anchorDate: '2026-07-06',
  startMin: 540,
  lenMin: 30,
  freq: 'weekly',
  endKind: 'never',
  untilDate: null,
  count: null,
  projectId: null,
}

function jsonFetch(
  status: number,
  body: unknown,
): { fetchImpl: typeof fetch; calls: { url: string; init: RequestInit }[] } {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl = ((url: string, init?: RequestInit) => {
    calls.push({ url, init: init ?? {} })
    const text = body === undefined ? '' : JSON.stringify(body)
    return Promise.resolve(new Response(text, { status }))
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

describe('parseSeries', () => {
  it('ParsesTheRuleColumns', () => {
    const s = parseSeries({ ...SERIES, endKind: 'count', count: 6 })
    expect(s).toMatchObject({ id: 's1', freq: 'weekly', endKind: 'count', count: 6, kind: 'focus' })
  })

  it('FallsBackForAnUnknownKindOrFreq', () => {
    const s = parseSeries({ ...SERIES, kind: 'weird', freq: 'yearly' })
    expect(s.kind).toBe('focus')
    expect(s.freq).toBe('weekly')
  })
})

describe('parseOccurrence', () => {
  it('ParsesADayProjection', () => {
    const o = parseOccurrence({
      seriesId: 's1',
      kind: 'meeting',
      title: 'Sync',
      date: '2026-07-13',
      startMin: 600,
      lenMin: 45,
      projectId: null,
    })
    expect(o).toEqual({
      seriesId: 's1',
      kind: 'meeting',
      title: 'Sync',
      date: '2026-07-13',
      startMin: 600,
      lenMin: 45,
      projectId: null,
    })
  })
})

describe('listOccurrences', () => {
  it('GetsTheWindowAndParsesTheRows', async () => {
    const rows = [
      {
        seriesId: 's1',
        kind: 'focus',
        title: 'Standup',
        date: '2026-07-06',
        startMin: 540,
        lenMin: 30,
        projectId: null,
      },
    ]
    const { fetchImpl, calls } = jsonFetch(200, rows)
    const occ = await listOccurrences(
      'http://api',
      { from: '2026-07-06', to: '2026-07-12' },
      fetchImpl,
    )
    expect(occ).toHaveLength(1)
    expect(occ[0]?.title).toBe('Standup')
    expect(calls[0]?.url).toContain('/api/recurrence/occurrences?from=2026-07-06&to=2026-07-12')
    expect(calls[0]?.init.method ?? 'GET').toBe('GET')
  })
})

describe('createSeries', () => {
  it('PostsTheNewSeriesAndReturnsIt', async () => {
    const { fetchImpl, calls } = jsonFetch(201, SERIES)
    const s = await createSeries(
      'http://api',
      {
        kind: 'focus',
        title: 'Standup',
        anchorDate: '2026-07-06',
        startMin: 540,
        lenMin: 30,
        freq: 'weekly',
      },
      fetchImpl,
    )
    expect(s.id).toBe('s1')
    expect(calls[0]?.init.method).toBe('POST')
    expect(calls[0]?.url).toContain('/api/recurrence')
  })
})

describe('truncateSeries', () => {
  it('PostsTheSplitDate', async () => {
    const { fetchImpl, calls } = jsonFetch(200, {
      ...SERIES,
      endKind: 'until',
      untilDate: '2026-07-19',
    })
    const s = await truncateSeries('http://api', 's1', '2026-07-20', fetchImpl)
    expect(s.endKind).toBe('until')
    expect(calls[0]?.init.method).toBe('POST')
    expect(calls[0]?.url).toContain('/api/recurrence/s1/truncate')
    expect(calls[0]?.init.body).toBe(JSON.stringify({ at: '2026-07-20' }))
  })
})
