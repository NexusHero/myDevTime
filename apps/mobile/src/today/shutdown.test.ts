import { describe, expect, it } from 'vitest'
import { todayShutdown } from './shutdown.js'

/**
 * Client glue for the Today Feierabend / shutdown ritual (REQ-063, design v17 §K5). The pure
 * `shutdownSummary` core owns every figure; this only assembles its inputs from the day's real
 * state (booked entries + the local reality spans) and decides which of the three honest states
 * the card shows — `idle` (nothing tracked or booked yet), `clean` (fully accounted), `review`
 * (unbooked reality or open drafts still to book).
 */
const HOUR = 3_600_000

describe('todayShutdown', () => {
  it('NothingTracked_isIdle', () => {
    const r = todayShutdown({ spans: [], booked: [], bookedMs: 0, tomorrowFirst: null })
    expect(r.state).toBe('idle')
    expect(r.summary.trackedMs).toBe(0)
    expect(r.summary.bookedMs).toBe(0)
    expect(r.recoveredMs).toBe(0)
  })

  it('AllTrackedTimeBooked_isClean', () => {
    // One 2h reality stretch, fully covered by a booked entry over the same window.
    const spans = [{ source: 'code', startMs: 0, endMs: 2 * HOUR }]
    const booked = [{ startMs: 0, endMs: 2 * HOUR }]
    const r = todayShutdown({ spans, booked, bookedMs: 2 * HOUR, tomorrowFirst: null })
    expect(r.state).toBe('clean')
    expect(r.summary.unbookedMs).toBe(0)
    expect(r.summary.openDraftCount).toBe(0)
    expect(r.summary.clean).toBe(true)
  })

  it('UnbookedRealityStretch_isReviewWithADraft', () => {
    // Two hours of reality, nothing booked → the whole stretch is one bookable draft.
    const spans = [{ source: 'figma', startMs: 0, endMs: 2 * HOUR }]
    const r = todayShutdown({ spans, booked: [], bookedMs: 0, tomorrowFirst: 'DEV-42 · Refactor' })
    expect(r.state).toBe('review')
    expect(r.summary.openDraftCount).toBe(1)
    expect(r.summary.unbookedMs).toBe(2 * HOUR)
    expect(r.recoveredMs).toBe(2 * HOUR)
    expect(r.summary.tomorrowFirst).toBe('DEV-42 · Refactor')
  })

  it('ExposesTheDraftListForTheReviewQueue', () => {
    // Two separate unbooked stretches → two bookable drafts, each carrying its window + source
    // for the KI6 review-queue (accept-to-book). Booked time between them is subtracted.
    const spans = [
      { source: 'figma', startMs: 0, endMs: 1 * HOUR },
      { source: 'code', startMs: 2 * HOUR, endMs: 4 * HOUR },
    ]
    const booked = [{ startMs: 1 * HOUR, endMs: 2 * HOUR }]
    const r = todayShutdown({ spans, booked, bookedMs: 1 * HOUR, tomorrowFirst: null })
    expect(r.drafts).toHaveLength(2)
    expect(r.drafts[0]).toMatchObject({ startMs: 0, endMs: 1 * HOUR, source: 'figma' })
    expect(r.drafts[1]).toMatchObject({ startMs: 2 * HOUR, endMs: 4 * HOUR, source: 'code' })
  })

  it('ShortUnbookedStretchBelowFloor_doesNotBecomeADraft', () => {
    // Ten minutes of unbooked reality is below the 15-min draft floor — no draft, but the
    // reality is still honestly counted as unbooked.
    const spans = [{ source: 'mail', startMs: 0, endMs: 10 * 60_000 }]
    const r = todayShutdown({ spans, booked: [], bookedMs: 0, tomorrowFirst: null })
    expect(r.summary.openDraftCount).toBe(0)
    expect(r.summary.unbookedMs).toBe(10 * 60_000)
    // Unbooked reality alone (no draft) still means the day is not clean.
    expect(r.state).toBe('review')
  })

  it('IdleSourcesDoNotCountAsTrackedWork', () => {
    // An `Idle` span is away-time, not work — it neither tracks nor drafts.
    const spans = [{ source: 'Idle', startMs: 0, endMs: 3 * HOUR }]
    const r = todayShutdown({ spans, booked: [], bookedMs: 0, tomorrowFirst: null })
    expect(r.summary.trackedMs).toBe(0)
    expect(r.state).toBe('idle')
  })
})
