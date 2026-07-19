import type { ExternalEvent } from '@mydevtime/domain'
import { CalendarUnavailableError, type CalendarPort, type CalendarRange } from './port.js'

/**
 * The Apple calendar adapter (design v17 §F6) — the ONE file that knows the Apple
 * calendar shape (skill §2.2; the port doc's confinement rule). Unlike Google /
 * Microsoft, Apple has **no OAuth calendar HTTP API**: on-device calendars are read
 * through the native **EventKit** framework, which only exists in a native
 * iOS/macOS build. This adapter therefore talks to an injectable native seam
 * (`EventKitSource`) rather than `fetch`.
 *
 * IMPORTANT — honesty by construction: the LIVE EventKit read only works inside a
 * native iOS/macOS build (device-handback), where the client bridges EventKit into
 * an `EventKitSource` and hands it in. On the server, in CI, and on the web there is
 * no EventKit: no source is supplied, `available()` is `false`, and `fetchEvents`
 * refuses with `CalendarUnavailableError` — it NEVER fabricates events. This mirrors
 * `NullCalendar`'s graceful degradation (ADR-0005); the import flow proposes nothing
 * rather than guessing.
 */

/** A raw EventKit event, as the native bridge hands it across the seam. */
export interface RawAppleEvent {
  /** EventKit's stable `eventIdentifier` — the merge key. */
  readonly identifier: string
  /** EventKit's `title`; may be null/empty for an untitled event. */
  readonly title: string | null
  /** Start instant, epoch ms (the bridge converts EKEvent.startDate). */
  readonly startMs: number
  /** Exclusive end instant, epoch ms (EKEvent.endDate). */
  readonly endMs: number
}

/**
 * The narrow native seam this adapter reads through. A native iOS/macOS build
 * supplies a real implementation backed by `EKEventStore`; every non-native host
 * (server/web/CI) leaves it unset, so the adapter degrades to unavailable.
 */
export interface EventKitSource {
  /** Whether EventKit exists AND access has been granted on this host. Cheap; no read. */
  available(): boolean
  /** Read EventKit events overlapping `range`. */
  events(range: CalendarRange): Promise<readonly RawAppleEvent[]>
}

/** The default seam on any host without EventKit: honestly unavailable, never fabricates. */
const UNAVAILABLE_EVENTKIT: EventKitSource = {
  available: () => false,
  events: () =>
    Promise.reject(new CalendarUnavailableError('apple', 'EventKit is not available on this host')),
}

function toExternalEvent(raw: RawAppleEvent): ExternalEvent | null {
  if (raw.identifier.length === 0) return null
  if (Number.isNaN(raw.startMs) || Number.isNaN(raw.endMs)) return null
  const title = raw.title?.trim()
  return {
    uid: raw.identifier,
    startMs: raw.startMs,
    endMs: raw.endMs,
    title: title !== undefined && title.length > 0 ? title : '(no title)',
  }
}

export interface AppleCalendarDeps {
  /**
   * The native EventKit seam. Omitted on any non-native host (server/web/CI), where
   * the adapter falls back to an unavailable source and behaves like `NullCalendar`.
   */
  readonly source?: EventKitSource
}

export class AppleCalendar implements CalendarPort {
  readonly provider = 'apple' as const
  private readonly source: EventKitSource

  constructor(deps: AppleCalendarDeps = {}) {
    this.source = deps.source ?? UNAVAILABLE_EVENTKIT
  }

  /** Available = a native EventKit seam exists and has access. No read happens here. */
  available(): Promise<boolean> {
    try {
      return Promise.resolve(this.source.available())
    } catch {
      return Promise.resolve(false)
    }
  }

  async fetchEvents(range: CalendarRange): Promise<readonly ExternalEvent[]> {
    if (!this.source.available()) {
      throw new CalendarUnavailableError('apple', 'EventKit is not available on this host')
    }
    let raw: readonly RawAppleEvent[]
    try {
      raw = await this.source.events(range)
    } catch (err) {
      if (err instanceof CalendarUnavailableError) throw err
      throw new CalendarUnavailableError('apple', 'EventKit read failed')
    }
    const events: ExternalEvent[] = []
    for (const item of raw) {
      const event = toExternalEvent(item)
      if (event !== null) events.push(event)
    }
    return events
  }
}
