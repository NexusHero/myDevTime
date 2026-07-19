import type { ExternalEvent } from '@mydevtime/domain'

/**
 * The one narrow calendar interface the app sees (REQ-064, design v17 §F6; skill §2.2). Google
 * Calendar and Apple Calendar are volatile vendors: each is reached through a single adapter that
 * confines the vendor SDK/auth to that one file and translates its events into the neutral domain
 * `ExternalEvent`. **Nothing upstream imports a vendor type.** The port only *reads* — it fetches
 * events for a window; what happens to them is the deterministic `mergeCalendar` core's decision
 * (ADR-0005), which yields ghost-block proposals the user confirms, never an auto-booked entry.
 * Live Google/Microsoft/Apple adapters are gated on their integration handback; the Null adapter
 * ships now as the graceful-degradation default and the seam features test against.
 */

/** Calendar providers. `null` is the graceful-degradation default (no provider configured). */
export type CalendarProvider = 'google' | 'microsoft' | 'apple' | 'null'

/** A half-open instant window `[fromMs, toMs)` to fetch events for. */
export interface CalendarRange {
  readonly fromMs: number
  readonly toMs: number
}

/**
 * The narrow calendar port. A feature depends on this, never a vendor SDK; the concrete adapter
 * is selected by config + stored consent at composition time. Implementations must be read-only
 * and side-effect-free beyond the provider call — they never mutate app state (that is the
 * confirmed-import flow's job, over the deterministic merge).
 */
export interface CalendarPort {
  readonly provider: CalendarProvider
  /** Fetch the provider's events in `range`. Throws `CalendarUnavailableError` when it is down. */
  fetchEvents(range: CalendarRange): Promise<readonly ExternalEvent[]>
  /** Whether the provider is configured, consented, and reachable (cheap; no fetch). */
  available(): Promise<boolean>
}

/**
 * Thrown when no calendar provider is configured/consented or the chosen one is unreachable. The
 * import flow must handle this and degrade — the deterministic core never depends on a calendar
 * being connected (ADR-0005).
 */
export class CalendarUnavailableError extends Error {
  readonly provider: CalendarProvider
  constructor(provider: CalendarProvider, message = 'calendar provider is not available') {
    super(message)
    this.name = 'CalendarUnavailableError'
    this.provider = provider
  }
}
