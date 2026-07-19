import {
  mergeCalendar,
  type ExternalEvent,
  type ImportedBlock,
  type MergeProposal,
} from '@mydevtime/domain'
import {
  CalendarUnavailableError,
  type CalendarPort,
  type CalendarProvider,
  type CalendarRange,
} from './port.js'
import { GoogleCalendar } from './google-calendar.js'
import { MicrosoftCalendar } from './microsoft-calendar.js'
import { AppleCalendar, type EventKitSource } from './apple-calendar.js'
import { NullCalendar } from './null-calendar.js'

/**
 * Calendar import planning (REQ-064, design v17 §F6): fetch a provider's events through the narrow
 * `CalendarPort` and diff them against what we already imported via the deterministic
 * `mergeCalendar` core (ADR-0005). The result is a **proposal** — ghost blocks to confirm — never
 * a write. Two hard gates come first: **consent** (no capture path without stored opt-in, REQ-025)
 * and **availability** (a down/unconfigured provider degrades to "nothing proposed", never throws
 * up the stack). Live Google/Apple adapters are spike-gated; the Null adapter exercises this seam.
 */

/**
 * Map a calendar connector id (registry) → the neutral `CalendarProvider`. Anything
 * that is not a known calendar connector resolves to `'null'` (graceful degradation).
 */
export function providerForConnector(id: string): CalendarProvider {
  switch (id) {
    case 'google-calendar':
      return 'google'
    case 'microsoft-calendar':
      return 'microsoft'
    case 'apple-calendar':
      return 'apple'
    default:
      return 'null'
  }
}

/** What each adapter needs from the composition root; all optional so callers wire only what applies. */
export interface CalendarPortDeps {
  /** A live OAuth access token (Google/Microsoft), or `null` when not connected/refreshable. */
  readonly accessToken?: () => Promise<string | null>
  /** The native EventKit seam (Apple) — only present in a native iOS/macOS build. */
  readonly eventKit?: EventKitSource
  /** Test/override transport for the HTTP adapters. */
  readonly fetchImpl?: typeof fetch
}

/**
 * Resolve the read-only `CalendarPort` for a provider, wiring the deps each adapter
 * needs (skill §2.2 — the one place adapters are selected). google → GoogleCalendar,
 * microsoft → MicrosoftCalendar, apple → AppleCalendar (native EventKit seam, honestly
 * unavailable off-device), everything else → NullCalendar. An OAuth provider with no
 * `accessToken` degrades to Null rather than pretending to be connected.
 */
export function resolveCalendarPort(
  provider: CalendarProvider,
  deps: CalendarPortDeps = {},
): CalendarPort {
  switch (provider) {
    case 'google':
      return deps.accessToken === undefined
        ? new NullCalendar()
        : new GoogleCalendar({
            accessToken: deps.accessToken,
            ...(deps.fetchImpl !== undefined ? { fetchImpl: deps.fetchImpl } : {}),
          })
    case 'microsoft':
      return deps.accessToken === undefined
        ? new NullCalendar()
        : new MicrosoftCalendar({
            accessToken: deps.accessToken,
            ...(deps.fetchImpl !== undefined ? { fetchImpl: deps.fetchImpl } : {}),
          })
    case 'apple':
      return new AppleCalendar(deps.eventKit !== undefined ? { source: deps.eventKit } : {})
    default:
      return new NullCalendar()
  }
}

export interface ImportPlan {
  /** The deterministic diff, or an empty proposal when the provider is off/unconsented. */
  readonly proposal: MergeProposal
  /** Why the plan is empty, when it is — surfaced honestly to the caller. */
  readonly status: 'ok' | 'no-consent' | 'unavailable'
}

const EMPTY = (status: ImportPlan['status']): ImportPlan => ({
  proposal: { changes: [], orphaned: [], unchangedCount: 0 },
  status,
})

/**
 * Plan a calendar import: consent-gated, availability-gated, then a deterministic merge. Returns
 * proposals only — the caller books nothing until the user confirms a ghost block. A provider that
 * throws `CalendarUnavailableError` mid-fetch degrades to an empty `unavailable` plan (ADR-0005).
 */
export async function planImport(
  port: CalendarPort,
  imported: readonly ImportedBlock[],
  range: CalendarRange,
  consented: boolean,
): Promise<ImportPlan> {
  if (!consented) return EMPTY('no-consent')
  if (!(await port.available())) return EMPTY('unavailable')
  let external: readonly ExternalEvent[]
  try {
    external = await port.fetchEvents(range)
  } catch (err) {
    if (err instanceof CalendarUnavailableError) return EMPTY('unavailable')
    throw err
  }
  return { proposal: mergeCalendar(external, imported), status: 'ok' }
}
