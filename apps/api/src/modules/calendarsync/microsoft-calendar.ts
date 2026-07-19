import { z } from 'zod'
import type { ExternalEvent } from '@mydevtime/domain'
import { CalendarUnavailableError, type CalendarPort, type CalendarRange } from './port.js'

/**
 * The live Microsoft (Outlook / Microsoft 365) calendar adapter — the ONE file
 * that knows Microsoft Graph's event wire shape (skill §2.2; the port doc's
 * confinement rule). Reads `/me/calendarView?startDateTime&endDateTime` for a
 * window (calendarView expands recurrences server-side, ordered by start) and
 * translates items into the neutral `ExternalEvent`. We send
 * `Prefer: outlook.timezone="UTC"` so Graph returns wall-clock times in UTC;
 * Graph's `start.dateTime` carries no zone suffix, so the mapper appends `Z`
 * when none is present (see `parseGraphDateTime`). Read-only by the port's
 * contract — write-back is a separate, consent-gated surface that does not exist
 * yet. Auth is a function handed in by the composition root (the connectors
 * module's vault + refresh flow); this file never touches the vault, the DB, or
 * an env var. Every failure degrades to `CalendarUnavailableError` (ADR-0005) —
 * the import flow proposes nothing rather than guessing.
 */

const CALENDAR_VIEW_ENDPOINT = 'https://graph.microsoft.com/v1.0/me/calendarView'
const FETCH_TIMEOUT_MS = 10_000
const PAGE_SIZE = 1000
const MAX_PAGES = 4

// Graph's wire shape (calendarView), narrowed to what the port needs. `start`/`end`
// are dateTimeTimeZone objects; `isCancelled` marks a declined/cancelled occurrence.
// Unknown keys are ignored; a malformed item is skipped, never guessed at.
const graphDateTimeSchema = z.object({
  dateTime: z.string().optional(),
  timeZone: z.string().optional(),
})
const graphEventSchema = z.object({
  id: z.string().min(1).optional(),
  subject: z.string().optional(),
  isCancelled: z.boolean().optional(),
  start: graphDateTimeSchema.optional(),
  end: graphDateTimeSchema.optional(),
})
const eventsPageSchema = z.object({
  value: z.array(z.unknown()).default([]),
  // Graph paginates with an absolute follow URL rather than an opaque token.
  '@odata.nextLink': z.string().optional(),
})

type GraphEvent = z.infer<typeof graphEventSchema>
type GraphDateTime = z.infer<typeof graphDateTimeSchema>

/**
 * Parse a Graph `dateTimeTimeZone`. Graph returns wall-clock time with NO zone
 * suffix (e.g. `2026-07-02T09:00:00.0000000`); because we request
 * `Prefer: outlook.timezone="UTC"`, those wall times are UTC, so we append `Z`
 * when the string carries no explicit `Z`/offset. A string that already has a
 * zone is parsed as-is.
 */
function parseGraphDateTime(dt: GraphDateTime): number {
  const s = dt.dateTime
  if (s === undefined) return Number.NaN
  const hasZone = /[zZ]|[+-]\d\d:?\d\d$/.test(s)
  return Date.parse(hasZone ? s : `${s}Z`)
}

function toExternalEvent(item: GraphEvent): ExternalEvent | null {
  if (item.id === undefined || item.isCancelled === true) return null
  if (item.start === undefined || item.end === undefined) return null
  const startMs = parseGraphDateTime(item.start)
  const endMs = parseGraphDateTime(item.end)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null
  const title = item.subject?.trim()
  return {
    uid: item.id,
    startMs,
    endMs,
    title: title !== undefined && title.length > 0 ? title : '(no title)',
  }
}

export interface MicrosoftCalendarDeps {
  /**
   * A live access token (the connectors module's vault + refresh flow), or
   * `null` when the user is not connected / the token cannot be refreshed.
   */
  readonly accessToken: () => Promise<string | null>
  readonly fetchImpl?: typeof fetch
}

export class MicrosoftCalendar implements CalendarPort {
  readonly provider = 'microsoft' as const

  constructor(private readonly deps: MicrosoftCalendarDeps) {}

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
      throw new CalendarUnavailableError('microsoft', 'no live Microsoft access token')
    }
    const fetchImpl = this.deps.fetchImpl ?? fetch
    const events: ExternalEvent[] = []
    // The first request builds the calendarView URL; subsequent pages follow the
    // absolute `@odata.nextLink` Graph hands back verbatim.
    const first = new URL(CALENDAR_VIEW_ENDPOINT)
    first.searchParams.set('startDateTime', new Date(range.fromMs).toISOString())
    first.searchParams.set('endDateTime', new Date(range.toMs).toISOString())
    first.searchParams.set('$select', 'id,subject,start,end,isCancelled')
    first.searchParams.set('$orderby', 'start/dateTime')
    first.searchParams.set('$top', String(PAGE_SIZE))
    let nextUrl: string | undefined = first.toString()

    for (let page = 0; page < MAX_PAGES && nextUrl !== undefined; page++) {
      let res: Response
      try {
        res = await fetchImpl(nextUrl, {
          headers: {
            authorization: `Bearer ${token}`,
            prefer: 'outlook.timezone="UTC"',
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
      } catch {
        throw new CalendarUnavailableError('microsoft', 'Microsoft Graph unreachable')
      }
      if (!res.ok) {
        throw new CalendarUnavailableError(
          'microsoft',
          `calendarView responded ${String(res.status)}`,
        )
      }
      const parsed = eventsPageSchema.safeParse(await res.json().catch(() => null))
      if (!parsed.success) {
        throw new CalendarUnavailableError('microsoft', 'unexpected calendarView response shape')
      }
      for (const raw of parsed.data.value) {
        const item = graphEventSchema.safeParse(raw)
        if (!item.success) continue
        const event = toExternalEvent(item.data)
        if (event !== null) events.push(event)
      }
      nextUrl = parsed.data['@odata.nextLink']
    }
    return events
  }
}
