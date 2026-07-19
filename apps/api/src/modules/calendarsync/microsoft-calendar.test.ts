import { describe, expect, it } from 'vitest'
import { MicrosoftCalendar } from './microsoft-calendar.js'
import { CalendarUnavailableError, type CalendarRange } from './port.js'

/**
 * The live Microsoft Graph calendar adapter — proven entirely against a fake fetch,
 * no network. Confirms the calendarView → `ExternalEvent` translation (UTC wall-time
 * parsing, title fallback, skip rules), the exact request shape (endpoint, window
 * params, `$select`/`$orderby`/`$top`, bearer auth, the UTC `Prefer` header),
 * pagination via `@odata.nextLink`, and that every failure degrades to
 * `CalendarUnavailableError` (ADR-0005) rather than guessing.
 */

const PAGE_SIZE = 1000
const MAX_PAGES = 4

interface Seen {
  readonly url: string
  readonly authorization: string | undefined
  readonly prefer: string | undefined
}

/** A fake fetch returning `pages` in order (the last repeats), capturing each call. */
function pagedFetch(
  pages: readonly { readonly status?: number; readonly body: unknown }[],
  seen: Seen[],
): typeof fetch {
  let call = 0
  return ((url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    seen.push({ url, authorization: headers.authorization, prefer: headers.prefer })
    const page = pages[Math.min(call, pages.length - 1)]
    call += 1
    return Promise.resolve(
      new Response(JSON.stringify(page?.body ?? {}), { status: page?.status ?? 200 }),
    )
  }) as unknown as typeof fetch
}

/** A fake fetch returning a raw (possibly non-JSON) body string. */
function rawFetch(status: number, raw: string): typeof fetch {
  return () => Promise.resolve(new Response(raw, { status }))
}

const RANGE: CalendarRange = {
  fromMs: Date.parse('2026-07-01T00:00:00.000Z'),
  toMs: Date.parse('2026-07-08T00:00:00.000Z'),
}

const alwaysToken = (token: string | null) => () => Promise.resolve(token)

describe('MicrosoftCalendar.available', () => {
  it('True_WhenAccessTokenResolvesAString', async () => {
    const cal = new MicrosoftCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: pagedFetch([], []),
    })
    expect(await cal.available()).toBe(true)
  })

  it('False_WhenAccessTokenResolvesNull', async () => {
    const cal = new MicrosoftCalendar({
      accessToken: alwaysToken(null),
      fetchImpl: pagedFetch([], []),
    })
    expect(await cal.available()).toBe(false)
  })

  it('False_WhenAccessTokenThrows', async () => {
    const cal = new MicrosoftCalendar({
      accessToken: () => Promise.reject(new Error('vault down')),
      fetchImpl: pagedFetch([], []),
    })
    expect(await cal.available()).toBe(false)
  })
})

describe('MicrosoftCalendar.fetchEvents mapping', () => {
  it('MapsUtcWallTimeEvents_WithTitleFallback', async () => {
    const seen: Seen[] = []
    const cal = new MicrosoftCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: pagedFetch(
        [
          {
            body: {
              value: [
                {
                  id: 'graph-1',
                  subject: 'Standup',
                  isCancelled: false,
                  // Graph wall-time has no zone suffix; we requested UTC via Prefer.
                  start: { dateTime: '2026-07-02T09:00:00.0000000', timeZone: 'UTC' },
                  end: { dateTime: '2026-07-02T09:30:00.0000000', timeZone: 'UTC' },
                },
                {
                  id: 'graph-2',
                  // already-zoned string is parsed as-is
                  start: { dateTime: '2026-07-03T12:00:00Z', timeZone: 'UTC' },
                  end: { dateTime: '2026-07-03T13:00:00Z', timeZone: 'UTC' },
                },
                {
                  id: 'blank-title',
                  subject: '   ',
                  start: { dateTime: '2026-07-05T12:00:00.0000000', timeZone: 'UTC' },
                  end: { dateTime: '2026-07-05T13:00:00.0000000', timeZone: 'UTC' },
                },
              ],
            },
          },
        ],
        seen,
      ),
    })

    const events = await cal.fetchEvents(RANGE)
    expect(events).toEqual([
      {
        uid: 'graph-1',
        startMs: Date.parse('2026-07-02T09:00:00.000Z'),
        endMs: Date.parse('2026-07-02T09:30:00.000Z'),
        title: 'Standup',
      },
      {
        uid: 'graph-2',
        startMs: Date.parse('2026-07-03T12:00:00.000Z'),
        endMs: Date.parse('2026-07-03T13:00:00.000Z'),
        title: '(no title)',
      },
      {
        uid: 'blank-title',
        startMs: Date.parse('2026-07-05T12:00:00.000Z'),
        endMs: Date.parse('2026-07-05T13:00:00.000Z'),
        title: '(no title)',
      },
    ])
  })

  it('SkipsCancelledMissingIdMissingBoundsAndUnparseableDates', async () => {
    const seen: Seen[] = []
    const cal = new MicrosoftCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: pagedFetch(
        [
          {
            body: {
              value: [
                {
                  id: 'cancelled',
                  isCancelled: true,
                  start: { dateTime: '2026-07-02T09:00:00.0000000', timeZone: 'UTC' },
                  end: { dateTime: '2026-07-02T09:30:00.0000000', timeZone: 'UTC' },
                },
                {
                  // no id
                  start: { dateTime: '2026-07-02T09:00:00.0000000', timeZone: 'UTC' },
                  end: { dateTime: '2026-07-02T09:30:00.0000000', timeZone: 'UTC' },
                },
                {
                  id: 'no-start',
                  end: { dateTime: '2026-07-02T09:30:00.0000000', timeZone: 'UTC' },
                },
                {
                  id: 'no-end',
                  start: { dateTime: '2026-07-02T09:00:00.0000000', timeZone: 'UTC' },
                },
                {
                  id: 'unparseable',
                  start: { dateTime: 'not-a-date', timeZone: 'UTC' },
                  end: { dateTime: 'also-bad', timeZone: 'UTC' },
                },
                {
                  id: 'good',
                  subject: 'Kept',
                  start: { dateTime: '2026-07-02T14:00:00.0000000', timeZone: 'UTC' },
                  end: { dateTime: '2026-07-02T15:00:00.0000000', timeZone: 'UTC' },
                },
              ],
            },
          },
        ],
        seen,
      ),
    })

    const events = await cal.fetchEvents(RANGE)
    expect(events.map(e => e.uid)).toEqual(['good'])
  })
})

describe('MicrosoftCalendar.fetchEvents request shape', () => {
  it('HitsCalendarViewEndpointWithWindowParams_BearerAuth_AndUtcPrefer', async () => {
    const seen: Seen[] = []
    const cal = new MicrosoftCalendar({
      accessToken: alwaysToken('secret-token'),
      fetchImpl: pagedFetch([{ body: { value: [] } }], seen),
    })

    await cal.fetchEvents(RANGE)

    expect(seen).toHaveLength(1)
    const url = new URL(seen[0]!.url)
    expect(`${url.origin}${url.pathname}`).toBe('https://graph.microsoft.com/v1.0/me/calendarView')
    expect(url.searchParams.get('startDateTime')).toBe(new Date(RANGE.fromMs).toISOString())
    expect(url.searchParams.get('endDateTime')).toBe(new Date(RANGE.toMs).toISOString())
    expect(url.searchParams.get('$select')).toBe('id,subject,start,end,isCancelled')
    expect(url.searchParams.get('$orderby')).toBe('start/dateTime')
    expect(url.searchParams.get('$top')).toBe(String(PAGE_SIZE))
    expect(seen[0]!.authorization).toBe('Bearer secret-token')
    expect(seen[0]!.prefer).toBe('outlook.timezone="UTC"')
  })
})

describe('MicrosoftCalendar.fetchEvents pagination', () => {
  it('FollowsODataNextLink_AndReturnsEventsFromEveryPage', async () => {
    const seen: Seen[] = []
    const nextLink = 'https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=page-2'
    const cal = new MicrosoftCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: pagedFetch(
        [
          {
            body: {
              '@odata.nextLink': nextLink,
              value: [
                {
                  id: 'e1',
                  subject: 'One',
                  start: { dateTime: '2026-07-02T09:00:00.0000000', timeZone: 'UTC' },
                  end: { dateTime: '2026-07-02T10:00:00.0000000', timeZone: 'UTC' },
                },
              ],
            },
          },
          {
            body: {
              value: [
                {
                  id: 'e2',
                  subject: 'Two',
                  start: { dateTime: '2026-07-03T09:00:00.0000000', timeZone: 'UTC' },
                  end: { dateTime: '2026-07-03T10:00:00.0000000', timeZone: 'UTC' },
                },
              ],
            },
          },
        ],
        seen,
      ),
    })

    const events = await cal.fetchEvents(RANGE)
    expect(events.map(e => e.uid)).toEqual(['e1', 'e2'])
    // Two fetches: the first to calendarView, the second to the absolute nextLink.
    expect(seen).toHaveLength(2)
    expect(seen[1]!.url).toBe(nextLink)
  })

  it('StopsAfterMaxPages_EvenWhenGraphKeepsPaging', async () => {
    const seen: Seen[] = []
    // Every page advertises another nextLink; the adapter must cap at MAX_PAGES.
    const cal = new MicrosoftCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: pagedFetch(
        [
          {
            body: {
              '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=more',
              value: [],
            },
          },
        ],
        seen,
      ),
    })

    await cal.fetchEvents(RANGE)
    expect(seen).toHaveLength(MAX_PAGES)
  })
})

describe('MicrosoftCalendar.fetchEvents empty range', () => {
  it('ReturnsNoEvents_WhenGraphReturnsAnEmptyPage', async () => {
    const cal = new MicrosoftCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: pagedFetch([{ body: { value: [] } }], []),
    })
    expect(await cal.fetchEvents(RANGE)).toEqual([])
  })
})

describe('MicrosoftCalendar.fetchEvents failures degrade to CalendarUnavailableError', () => {
  it('NoLiveToken_Throws', async () => {
    const cal = new MicrosoftCalendar({
      accessToken: alwaysToken(null),
      fetchImpl: pagedFetch([], []),
    })
    await expect(cal.fetchEvents(RANGE)).rejects.toBeInstanceOf(CalendarUnavailableError)
    await expect(cal.fetchEvents(RANGE)).rejects.toMatchObject({ provider: 'microsoft' })
  })

  it('TokenLookupThrows_Throws', async () => {
    const cal = new MicrosoftCalendar({
      accessToken: () => Promise.reject(new Error('vault down')),
      fetchImpl: pagedFetch([], []),
    })
    await expect(cal.fetchEvents(RANGE)).rejects.toBeInstanceOf(CalendarUnavailableError)
  })

  it('NonOkResponse_Throws', async () => {
    const cal = new MicrosoftCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: pagedFetch([{ status: 401, body: { error: 'invalid_token' } }], []),
    })
    await expect(cal.fetchEvents(RANGE)).rejects.toBeInstanceOf(CalendarUnavailableError)
    await expect(cal.fetchEvents(RANGE)).rejects.toThrow(/401/)
  })

  it('MalformedJson_Throws', async () => {
    const cal = new MicrosoftCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: rawFetch(200, 'not-json-at-all'),
    })
    await expect(cal.fetchEvents(RANGE)).rejects.toBeInstanceOf(CalendarUnavailableError)
  })

  it('NetworkError_Throws', async () => {
    const cal = new MicrosoftCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: () => Promise.reject(new Error('ECONNRESET')),
    })
    await expect(cal.fetchEvents(RANGE)).rejects.toBeInstanceOf(CalendarUnavailableError)
  })
})
