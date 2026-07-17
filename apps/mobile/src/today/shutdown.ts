import {
  MINUTE_MS,
  shutdownSummary,
  timesheetDrafts,
  trackedMs,
  type BookedSpan,
  type ShutdownSummary,
  type TimedSpan,
} from '@mydevtime/domain'

/**
 * Client glue for the Today Feierabend / shutdown ritual (REQ-063, design v17 §K5). The
 * deterministic `shutdownSummary` core owns every figure (ADR-0005); this only assembles its
 * inputs from the day's **real** state — the auto-tracker's local reality spans and today's
 * booked entries — and resolves the honest state the card shows. Nothing is fabricated: with an
 * empty day it is `idle`, and it lights up only as real reality and bookings flow.
 */

/** Below this, an unbooked stretch is noise, not a bookable draft (matches KI6's floor). */
const DRAFT_FLOOR_MS = 15 * MINUTE_MS

/** `idle` — nothing tracked or booked yet · `clean` — fully accounted · `review` — work still to book. */
export type ShutdownState = 'idle' | 'clean' | 'review'

export interface TodayShutdownInput {
  /** The auto-tracker's local reality spans for today. */
  readonly spans: readonly TimedSpan[]
  /** Today's booked entries as intervals (for the unbooked-stretch subtraction). */
  readonly booked: readonly BookedSpan[]
  /** Today's booked time in ms (the summary's booked figure). */
  readonly bookedMs: number
  /** Label of tomorrow's first planned block, or `null` when nothing is planned. */
  readonly tomorrowFirst: string | null
}

export interface TodayShutdown {
  readonly summary: ShutdownSummary
  /** Total time the open drafts would recover if booked. */
  readonly recoveredMs: number
  readonly state: ShutdownState
}

/**
 * Assemble the day-close view-model. `trackedMs`/`timesheetDrafts` read the reality spans
 * (idle excluded, booked subtracted); `shutdownSummary` folds them with the booked total. The
 * state is `idle` when the day holds no real work or bookings, otherwise `clean` when the
 * summary is fully accounted, else `review`.
 */
export function todayShutdown(input: TodayShutdownInput): TodayShutdown {
  const tracked = trackedMs(input.spans)
  const drafts = timesheetDrafts(input.spans, input.booked, { minDraftMs: DRAFT_FLOOR_MS })
  const summary = shutdownSummary({
    bookedMs: input.bookedMs,
    trackedMs: tracked,
    openDraftCount: drafts.drafts.length,
    tomorrowFirst: input.tomorrowFirst,
  })
  const state: ShutdownState =
    summary.trackedMs === 0 && summary.bookedMs === 0 ? 'idle' : summary.clean ? 'clean' : 'review'
  return { summary, recoveredMs: drafts.recoveredMs, state }
}
