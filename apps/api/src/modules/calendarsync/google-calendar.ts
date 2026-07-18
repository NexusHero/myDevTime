import { z } from 'zod'
import type { ExternalEvent } from '@mydevtime/domain'
import { CalendarUnavailableError, type CalendarPort, type CalendarRange } from './port.js'

/**
 * The live Google Calendar adapter (REQ-010, #15) — the ONE file that knows
 * Google's events wire shape (skill §2.2; the port doc's confinement rule).
 * Reads `calendars/primary/events` for a window (`singleEvents=true` expands
 * recurrences, `orderBy=startTime`) and translates items into the neutral
 * `ExternalEvent`. Read-only by the port's contract — write-back (REQ-034, #43)
 * is a separate, consent-gated surface that does not exist yet. Auth is a
 * function handed in by the composition root (the connectors module's vault +
 * refresh flow); this file never touches the vault, the DB, or an env var.
 * Every failure degrades to `CalendarUnavailableError` (ADR-0005) — the import
 * flow proposes nothing rather than guessing.
 */

const EVENTS_ENDPOINT = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const FETCH_TIMEOUT_MS = 10_000
const PAGE_SIZE = 2500
const MAX_PAGES = 4

// Google's wire shape (events.list), narrowed to what the port needs. All-day
// events carry `start.date`/`end.date`; timed ones `dateTime`. Unknown keys are
// ignored; a malformed item is skipped, never guessed at.
const googleEventSchema = z.object({
  id: z.string().min(1).optional(),
  status: z.string().optional(),
  summary: z.string().optional(),
  start: z.object({ dateTime: z.string().optional(), date: z.string().optional() }).optional(),
  end: z.object({ dateTime: z.string().optional(), date: z.string().optional() }).optional(),
})
const eventsPageSchema = z.object({
  items: z.array(z.unknown()).default([]),
  nextPageToken: z.string().optional(),
})

type GoogleEvent = z.infer<typeof googleEventSchema>

function toExternalEvent(item: GoogleEvent): ExternalEvent | null {
  if (item.id === undefined || item.status === 'cancelled') return null
  const start = item.start?.dateTime ?? item.start?.date
  const end = item.end?.dateTime ?? item.end?.date
  if (start === undefined || end === undefined) return null
  const startMs = Date.parse(start)
  const endMs = Date.parse(end)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null
  const title = item.summary?.trim()
  return {
    uid: item.id,
    startMs,
    endMs,
    title: title !== undefined && title.length > 0 ? title : '(no title)',
  }
}

export interface GoogleCalendarDeps {
  /**
   * A live access token (the connectors module's vault + refresh flow), or
   * `null` when the user is not connected / the token cannot be refreshed.
   */
  readonly accessToken: () => Promise<string | null>
  readonly fetchImpl?: typeof fetch
}

export class GoogleCalendar implements CalendarPort {
  readonly provider = 'google' as const

  constructor(private readonly deps: GoogleCalendarDeps) {}

  /** Available = a live token can be produced. No calendar fetch happens here. */
  async available(): Promise<boolean> {
    try {
      return (await this.deps.accessToken()) !== null
    } catch {
      return false
    }
  }

  async fetchEvents(range: CalendarRange): Promise<readonly ExternalEvent[]> {
    let token: string | null
    try {
      token = await this.deps.accessToken()
    } catch {
      token = null
    }
    if (token === null) {
      throw new CalendarUnavailableError('google', 'no live Google access token')
    }
    const fetchImpl = this.deps.fetchImpl ?? fetch
    const events: ExternalEvent[] = []
    let pageToken: string | undefined
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(EVENTS_ENDPOINT)
      url.searchParams.set('timeMin', new Date(range.fromMs).toISOString())
      url.searchParams.set('timeMax', new Date(range.toMs).toISOString())
      url.searchParams.set('singleEvents', 'true')
      url.searchParams.set('orderBy', 'startTime')
      url.searchParams.set('maxResults', String(PAGE_SIZE))
      if (pageToken !== undefined) url.searchParams.set('pageToken', pageToken)

      let res: Response
      try {
        res = await fetchImpl(url.toString(), {
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
      } catch {
        throw new CalendarUnavailableError('google', 'Google Calendar unreachable')
      }
      if (!res.ok) {
        throw new CalendarUnavailableError('google', `events.list responded ${String(res.status)}`)
      }
      const parsed = eventsPageSchema.safeParse(await res.json().catch(() => null))
      if (!parsed.success) {
        throw new CalendarUnavailableError('google', 'unexpected events.list response shape')
      }
      for (const raw of parsed.data.items) {
        const item = googleEventSchema.safeParse(raw)
        if (!item.success) continue
        const event = toExternalEvent(item.data)
        if (event !== null) events.push(event)
      }
      pageToken = parsed.data.nextPageToken
      if (pageToken === undefined) break
    }
    return events
  }
}
