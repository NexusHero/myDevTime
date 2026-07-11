import { describe, expect, it } from 'vitest'
import { reconcileCoverage, type BookedInterval } from './coverage.js'
import type { Shift } from './worktime.js'

const H = 60 * 60 * 1000
// A base local morning instant; exact epoch value is irrelevant to the math.
const T0 = Date.UTC(2026, 6, 13, 6, 0, 0) // Mon 08:00 CEST-ish, but tz is not used here

function shift(startH: number, endH: number, breakMs = 0): Shift {
  return { start: T0 + startH * H, end: T0 + endH * H, breakMs }
}
function booked(startH: number, endH: number): BookedInterval {
  return { start: T0 + startH * H, end: T0 + endH * H }
}

describe('reconcileCoverage', () => {
  it('NoShifts_ReturnsAllZeroAndZeroRatio', () => {
    const r = reconcileCoverage([], [booked(0, 2)])
    expect(r.workedSpanMs).toBe(0)
    expect(r.workedNetMs).toBe(0)
    expect(r.bookedWithinMs).toBe(0)
    expect(r.uncoveredMs).toBe(0)
    expect(r.coverageRatio).toBe(0)
    // Booking with no shift to sit in counts entirely as booked-outside.
    expect(r.bookedOutsideMs).toBe(2 * H)
  })

  it('FullyBookedShift_HasNoGapAndRatioOne', () => {
    const r = reconcileCoverage([shift(0, 8)], [booked(0, 8)])
    expect(r.workedSpanMs).toBe(8 * H)
    expect(r.bookedWithinMs).toBe(8 * H)
    expect(r.uncoveredMs).toBe(0)
    expect(r.bookedOutsideMs).toBe(0)
    expect(r.coverageRatio).toBe(1)
  })

  it('HalfBookedShift_ReportsHalfAsUncovered', () => {
    const r = reconcileCoverage([shift(0, 8)], [booked(0, 4)])
    expect(r.bookedWithinMs).toBe(4 * H)
    expect(r.uncoveredMs).toBe(4 * H)
    expect(r.coverageRatio).toBeCloseTo(0.5, 10)
  })

  it('BookingOutsideShift_CountsAsOutsideNotCoverage', () => {
    // Worked 0–4; a booking 5–7 sits entirely outside the worked window.
    const r = reconcileCoverage([shift(0, 4)], [booked(5, 7)])
    expect(r.bookedWithinMs).toBe(0)
    expect(r.bookedOutsideMs).toBe(2 * H)
    expect(r.uncoveredMs).toBe(4 * H) // the whole worked window is unbooked
  })

  it('OverlappingBookings_CountUnionOnce', () => {
    // Two bookings overlapping within one shift must not double-count.
    const r = reconcileCoverage([shift(0, 8)], [booked(0, 5), booked(3, 6)])
    expect(r.bookedWithinMs).toBe(6 * H) // union 0–6, not 5+3
    expect(r.uncoveredMs).toBe(2 * H)
  })

  it('BreakReducesNetButNotSpanOrCoverage', () => {
    const r = reconcileCoverage([shift(0, 8, 1 * H)], [booked(0, 8)])
    expect(r.workedSpanMs).toBe(8 * H)
    expect(r.workedNetMs).toBe(7 * H)
    expect(r.breakMs).toBe(1 * H)
    expect(r.uncoveredMs).toBe(0)
  })

  it('BookingStraddlingShiftEdge_SplitsWithinAndOutside', () => {
    // Worked 2–6; booking 0–4 → 2h within (2–4), 2h outside (0–2).
    const r = reconcileCoverage([shift(2, 6)], [booked(0, 4)])
    expect(r.bookedWithinMs).toBe(2 * H)
    expect(r.bookedOutsideMs).toBe(2 * H)
    expect(r.uncoveredMs).toBe(2 * H) // 4–6 worked but unbooked
  })

  it('MultipleShiftsWithGap_UnionsCorrectly', () => {
    // Morning 0–4 and afternoon 5–9; one booking 1–7 covers 3h in morning-window
    // (1–4) and 2h in afternoon-window (5–7).
    const r = reconcileCoverage([shift(0, 4), shift(5, 9)], [booked(1, 7)])
    expect(r.workedSpanMs).toBe(8 * H) // 4 + 4
    expect(r.bookedWithinMs).toBe(5 * H) // 3 + 2
    expect(r.bookedOutsideMs).toBe(1 * H) // 4–5 is between shifts
    expect(r.uncoveredMs).toBe(3 * H) // 0–1 and 7–9
  })

  it('InvalidShiftsAndBookings_AreIgnored', () => {
    const bad: Shift = { start: T0 + 5 * H, end: T0 + 2 * H, breakMs: 0 } // end < start
    const badBooking: BookedInterval = { start: T0 + 3 * H, end: T0 + 3 * H } // empty
    const r = reconcileCoverage([bad, shift(0, 4)], [badBooking, booked(0, 2)])
    expect(r.workedSpanMs).toBe(4 * H)
    expect(r.bookedWithinMs).toBe(2 * H)
    expect(r.uncoveredMs).toBe(2 * H)
  })
})
