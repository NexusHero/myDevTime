import { describe, expect, it } from 'vitest'
import {
  parseClientsOpen,
  parseIssuedInvoice,
  parseOpenAging,
  parsePreview,
  fetchClientsOpen,
  fetchOpenAging,
  issueInvoice,
} from './invoicing.js'

describe('parseClientsOpen', () => {
  it('parseClientsOpen_readsPerClientOpenFigures', () => {
    const parsed = parseClientsOpen({
      currencyCode: 'EUR',
      clients: [{ clientId: 'c1', openMs: 3600000, openMinor: 10000 }],
    })
    expect(parsed).toEqual({
      currencyCode: 'EUR',
      clients: [{ clientId: 'c1', openMs: 3600000, openMinor: 10000 }],
    })
  })
})

describe('parseOpenAging', () => {
  it('ReadsBucketsAndTotals', () => {
    const parsed = parseOpenAging({
      currencyCode: 'EUR',
      totalMinor: 1980,
      totalMs: 3600000,
      buckets: [
        { key: 'recent', minor: 1240, ms: 1200000 },
        { key: 'mid', minor: 520, ms: 1200000 },
        { key: 'old', minor: 220, ms: 1200000 },
      ],
    })
    expect(parsed.totalMinor).toBe(1980)
    expect(parsed.buckets[0]).toEqual({ key: 'recent', minor: 1240, ms: 1200000 })
  })

  it('RejectsAnUnknownBucketKey', () => {
    expect(() =>
      parseOpenAging({
        currencyCode: 'EUR',
        totalMinor: 0,
        totalMs: 0,
        buckets: [{ key: 'x', minor: 0, ms: 0 }],
      }),
    ).toThrow()
  })
})

describe('parsePreview', () => {
  it('parsePreview_readsLines_nullableTaskAndNote', () => {
    const parsed = parsePreview({
      currencyCode: 'EUR',
      lines: [
        {
          entryId: 'e1',
          projectId: 'p1',
          taskId: null,
          start: 1700000000000,
          durationMs: 3600000,
          amountMinor: 10000,
          priced: true,
          note: 'Checkout',
        },
      ],
    })
    expect(parsed.lines[0]).toMatchObject({
      entryId: 'e1',
      taskId: null,
      priced: true,
      note: 'Checkout',
    })
  })

  it('parsePreview_nonBooleanPriced_isFalse', () => {
    const parsed = parsePreview({
      currencyCode: 'EUR',
      lines: [
        {
          entryId: 'e1',
          projectId: 'p1',
          taskId: 't1',
          start: 1,
          durationMs: 1,
          amountMinor: 0,
          priced: 'yes',
          note: null,
        },
      ],
    })
    // `priced` is strictly boolean-coerced (only literal `true` counts as priced).
    expect(parsed.lines[0]).toMatchObject({ priced: false, note: null, taskId: 't1' })
  })
})

describe('parseIssuedInvoice', () => {
  it('parseIssuedInvoice_readsFrozenTotals', () => {
    const parsed = parseIssuedInvoice({
      id: 'inv1',
      clientId: 'c1',
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-08-01T00:00:00.000Z',
      totalMs: 7200000,
      totalMinor: 20000,
      currencyCode: 'EUR',
      issuedAt: '2026-07-14T00:00:00.000Z',
    })
    expect(parsed).toMatchObject({ id: 'inv1', totalMinor: 20000, currencyCode: 'EUR' })
  })
})

describe('invoicing fetchers use the right routes', () => {
  it('fetchClientsOpen_getsClientsOpen', async () => {
    let seen = ''
    const fake: typeof fetch = input => {
      if (typeof input === 'string') seen = input
      return Promise.resolve(
        new Response(JSON.stringify({ currencyCode: 'EUR', clients: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    }
    await fetchClientsOpen('http://api', fake)
    expect(seen).toBe('http://api/api/billing/clients/open')
  })

  it('fetchOpenAging_getsTheAgingRoute', async () => {
    let seen = ''
    const fake: typeof fetch = input => {
      if (typeof input === 'string') seen = input
      return Promise.resolve(
        new Response(
          JSON.stringify({ currencyCode: 'EUR', totalMinor: 0, totalMs: 0, buckets: [] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
    }
    await fetchOpenAging('http://api', fake)
    expect(seen).toBe('http://api/api/billing/aging')
  })

  it('issueInvoice_postsSelectedEntryIds', async () => {
    let body = ''
    const fake: typeof fetch = (_input, init) => {
      if (typeof init?.body === 'string') body = init.body
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'i1',
            clientId: 'c1',
            periodStart: 'a',
            periodEnd: 'b',
            totalMs: 1,
            totalMinor: 1,
            currencyCode: 'EUR',
            issuedAt: 'c',
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        ),
      )
    }
    await issueInvoice(
      'http://api',
      { clientId: 'c1', from: 'a', to: 'b', entryIds: ['e1', 'e2'] },
      fake,
    )
    expect(JSON.parse(body)).toMatchObject({ clientId: 'c1', entryIds: ['e1', 'e2'] })
  })
})
