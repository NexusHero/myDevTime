import { describe, expect, it } from 'vitest'
import { GoogleCalendar } from './google-calendar.js'
import { CalendarUnavailableError, type CalendarRange } from './port.js'

/**
 * The live Google Calendar adapter (REQ-010, #15) — proven entirely against a fake
 * fetch, no network. Confirms the events.list → `ExternalEvent` translation (timed
 * and all-day, title fallback, skip rules), the exact request shape (endpoint,
 * window params, bearer auth), pagination via `nextPageToken`, and that every
 * failure degrades to `CalendarUnavailableError` (ADR-0005) rather than guessing.
 */

// The adapter's paging constants (read from google-calendar.ts): a page requests
// maxResults=PAGE_SIZE and the loop follows at most MAX_PAGES nextPageTokens.
const PAGE_SIZE = 2500
const MAX_PAGES = 4

interface Seen {
  readonly url: string
  readonly authorization: string | undefined
}

/** A fake fetch returning `pages` in order (the last repeats), capturing each call. */
function pagedFetch(
  pages: readonly { readonly status?: number; readonly body: unknown }[],
  seen: Seen[],
): typeof fetch {
  let call = 0
  return ((url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    seen.push({ url, authorization: headers.authorization })
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

describe('GoogleCalendar.available', () => {
  it('True_WhenAccessTokenResolvesAString', async () => {
    const cal = new GoogleCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: pagedFetch([], []),
    })
    expect(await cal.available()).toBe(true)
  })

  it('False_WhenAccessTokenResolvesNull', async () => {
    const cal = new GoogleCalendar({
      accessToken: alwaysToken(null),
      fetchImpl: pagedFetch([], []),
    })
    expect(await cal.available()).toBe(false)
  })

  it('False_WhenAccessTokenThrows', async () => {
    const cal = new GoogleCalendar({
      accessToken: () => Promise.reject(new Error('vault down')),
      fetchImpl: pagedFetch([], []),
    })
    expect(await cal.available()).toBe(false)
  })
})

describe('GoogleCalendar.fetchEvents mapping', () => {
  it('MapsTimedAndAllDayEvents_WithTitleFallback', async () => {
    const seen: Seen[] = []
    const cal = new GoogleCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: pagedFetch(
        [
          {
            body: {
              items: [
                {
                  id: 'timed-1',
                  status: 'confirmed',
                  summary: 'Standup',
                  start: { dateTime: '2026-07-02T09:00:00.000Z' },
                  end: { dateTime: '2026-07-02T09:30:00.000Z' },
                },
                {
                  id: 'allday-1',
                  summary: 'Conference',
                  start: { date: '2026-07-03' },
                  end: { date: '2026-07-04' },
                },
                {
                  id: 'blank-title',
                  summary: '   ',
                  start: { dateTime: '2026-07-05T12:00:00.000Z' },
                  end: { dateTime: '2026-07-05T13:00:00.000Z' },
                },
                {
                  id: 'missing-title',
                  start: { dateTime: '2026-07-06T12:00:00.000Z' },
                  end: { dateTime: '2026-07-06T13:00:00.000Z' },
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
        uid: 'timed-1',
        startMs: Date.parse('2026-07-02T09:00:00.000Z'),
        endMs: Date.parse('2026-07-02T09:30:00.000Z'),
        title: 'Standup',
      },
      {
        uid: 'allday-1',
        startMs: Date.parse('2026-07-03'),
        endMs: Date.parse('2026-07-04'),
        title: 'Conference',
      },
      {
        uid: 'blank-title',
        startMs: Date.parse('2026-07-05T12:00:00.000Z'),
        endMs: Date.parse('2026-07-05T13:00:00.000Z'),
        title: '(no title)',
      },
      {
        uid: 'missing-title',
        startMs: Date.parse('2026-07-06T12:00:00.000Z'),
        endMs: Date.parse('2026-07-06T13:00:00.000Z'),
        title: '(no title)',
      },
    ])
  })

  it('SkipsCancelledMissingIdMissingBoundsAndUnparseableDates', async () => {
    const seen: Seen[] = []
    const cal = new GoogleCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: pagedFetch(
        [
          {
            body: {
              items: [
                {
                  id: 'cancelled',
                  status: 'cancelled',
                  start: { dateTime: '2026-07-02T09:00:00.000Z' },
                  end: { dateTime: '2026-07-02T09:30:00.000Z' },
                },
                {
                  // no id
                  start: { dateTime: '2026-07-02T09:00:00.000Z' },
                  end: { dateTime: '2026-07-02T09:30:00.000Z' },
                },
                { id: 'no-start', end: { dateTime: '2026-07-02T09:30:00.000Z' } },
                { id: 'no-end', start: { dateTime: '2026-07-02T09:00:00.000Z' } },
                {
                  id: 'unparseable',
                  start: { dateTime: 'not-a-date' },
                  end: { dateTime: 'also-bad' },
                },
                {
                  id: 'good',
                  summary: 'Kept',
                  start: { dateTime: '2026-07-02T14:00:00.000Z' },
                  end: { dateTime: '2026-07-02T15:00:00.000Z' },
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

describe('GoogleCalendar.fetchEvents request shape', () => {
  it('HitsEventsEndpointWithWindowParams_AndBearerAuth', async () => {
    const seen: Seen[] = []
    const cal = new GoogleCalendar({
      accessToken: alwaysToken('secret-token'),
      fetchImpl: pagedFetch([{ body: { items: [] } }], seen),
    })

    await cal.fetchEvents(RANGE)

    expect(seen).toHaveLength(1)
    const url = new URL(seen[0]!.url)
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    )
    expect(url.searchParams.get('timeMin')).toBe(new Date(RANGE.fromMs).toISOString())
    expect(url.searchParams.get('timeMax')).toBe(new Date(RANGE.toMs).toISOString())
    expect(url.searchParams.get('singleEvents')).toBe('true')
    expect(url.searchParams.get('orderBy')).toBe('startTime')
    expect(url.searchParams.get('maxResults')).toBe(String(PAGE_SIZE))
    expect(seen[0]!.authorization).toBe('Bearer secret-token')
  })
})

describe('GoogleCalendar.fetchEvents pagination', () => {
  it('FollowsNextPageToken_AndReturnsEventsFromEveryPage', async () => {
    const seen: Seen[] = []
    const cal = new GoogleCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: pagedFetch(
        [
          {
            body: {
              nextPageToken: 'page-2',
              items: [
                {
                  id: 'e1',
                  summary: 'One',
                  start: { dateTime: '2026-07-02T09:00:00.000Z' },
                  end: { dateTime: '2026-07-02T10:00:00.000Z' },
                },
              ],
            },
          },
          {
            body: {
              items: [
                {
                  id: 'e2',
                  summary: 'Two',
                  start: { dateTime: '2026-07-03T09:00:00.000Z' },
                  end: { dateTime: '2026-07-03T10:00:00.000Z' },
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
    // Two fetches: the first without a pageToken, the second carrying it.
    expect(seen).toHaveLength(2)
    expect(new URL(seen[0]!.url).searchParams.get('pageToken')).toBeNull()
    expect(new URL(seen[1]!.url).searchParams.get('pageToken')).toBe('page-2')
  })

  it('StopsAfterMaxPages_EvenWhenTheProviderKeepsPaging', async () => {
    const seen: Seen[] = []
    // Every page advertises another nextPageToken; the adapter must cap at MAX_PAGES.
    const cal = new GoogleCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: pagedFetch([{ body: { nextPageToken: 'more', items: [] } }], seen),
    })

    await cal.fetchEvents(RANGE)
    expect(seen).toHaveLength(MAX_PAGES)
  })
})

describe('GoogleCalendar.fetchEvents failures degrade to CalendarUnavailableError', () => {
  it('NoLiveToken_Throws', async () => {
    const cal = new GoogleCalendar({
      accessToken: alwaysToken(null),
      fetchImpl: pagedFetch([], []),
    })
    await expect(cal.fetchEvents(RANGE)).rejects.toBeInstanceOf(CalendarUnavailableError)
    await expect(cal.fetchEvents(RANGE)).rejects.toMatchObject({ provider: 'google' })
  })

  it('TokenLookupThrows_Throws', async () => {
    const cal = new GoogleCalendar({
      accessToken: () => Promise.reject(new Error('vault down')),
      fetchImpl: pagedFetch([], []),
    })
    await expect(cal.fetchEvents(RANGE)).rejects.toBeInstanceOf(CalendarUnavailableError)
  })

  it('NonOkResponse_Throws', async () => {
    const cal = new GoogleCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: pagedFetch([{ status: 401, body: { error: 'invalid_credentials' } }], []),
    })
    await expect(cal.fetchEvents(RANGE)).rejects.toBeInstanceOf(CalendarUnavailableError)
    await expect(cal.fetchEvents(RANGE)).rejects.toThrow(/401/)
  })

  it('MalformedJson_Throws', async () => {
    const cal = new GoogleCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: rawFetch(200, 'not-json-at-all'),
    })
    await expect(cal.fetchEvents(RANGE)).rejects.toBeInstanceOf(CalendarUnavailableError)
  })

  it('NetworkError_Throws', async () => {
    const cal = new GoogleCalendar({
      accessToken: alwaysToken('AT'),
      fetchImpl: () => Promise.reject(new Error('ECONNRESET')),
    })
    await expect(cal.fetchEvents(RANGE)).rejects.toBeInstanceOf(CalendarUnavailableError)
  })
})
