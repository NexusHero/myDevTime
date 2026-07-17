import { describe, expect, it } from 'vitest'
import { shutdownSummary } from './summary.js'

const H = 3_600_000

/**
 * Acceptance for the shutdown-ritual summary (REQ-063, design v17 §K5). It gathers the day's
 * real state — booked, reality, unbooked remainder, open drafts, tomorrow's first block — and
 * says whether the day is fully accounted for. Pure and deterministic (ADR-0005).
 */
describe('shutdownSummary', () => {
  it('ComputesTheUnbookedReminderAsTrackedMinusBooked', () => {
    const s = shutdownSummary({
      bookedMs: 6 * H,
      trackedMs: 8 * H,
      openDraftCount: 2,
      tomorrowFirst: 'Standup 09:00',
    })
    expect(s.unbookedMs).toBe(2 * H)
    expect(s.openDraftCount).toBe(2)
    expect(s.tomorrowFirst).toBe('Standup 09:00')
    expect(s.clean).toBe(false)
  })

  it('IsCleanWhenNothingIsOpen', () => {
    const s = shutdownSummary({
      bookedMs: 8 * H,
      trackedMs: 8 * H,
      openDraftCount: 0,
      tomorrowFirst: null,
    })
    expect(s.unbookedMs).toBe(0)
    expect(s.clean).toBe(true)
  })

  it('ClampsUnbookedAtZeroWhenBookedExceedsTracked', () => {
    const s = shutdownSummary({
      bookedMs: 9 * H,
      trackedMs: 7 * H,
      openDraftCount: 0,
      tomorrowFirst: null,
    })
    expect(s.unbookedMs).toBe(0)
    expect(s.clean).toBe(true)
  })

  it('IsNotCleanWhileDraftsAwaitReview_EvenIfRealityIsBooked', () => {
    const s = shutdownSummary({
      bookedMs: 8 * H,
      trackedMs: 8 * H,
      openDraftCount: 1,
      tomorrowFirst: null,
    })
    expect(s.clean).toBe(false)
  })
})
