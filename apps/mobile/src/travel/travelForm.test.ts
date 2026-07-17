import { describe, expect, it } from 'vitest'
import { buildLeg, previewLeg, returnForm, travelNote, type TravelForm } from './travelForm.js'

/**
 * Pure glue for the travel drawer (REQ-051, G4). The money/worktime math is the domain
 * core's; these tests pin the input-shaping and the human note.
 */
const form: TravelForm = {
  from: 'Home Office',
  to: 'Client HQ',
  distanceKm: 42,
  mode: 'car',
  durationMin: 60,
  billable: true,
}
const now = new Date(2026, 2, 4, 18, 0, 0)

describe('buildLeg', () => {
  it('EndsAtNowAndSpansTheDuration', () => {
    const leg = buildLeg(form, now)
    expect(leg.endMs).toBe(now.getTime())
    expect(leg.endMs - leg.startMs).toBe(60 * 60_000)
    expect(leg.from).toBe('Home Office')
    expect(leg.to).toBe('Client HQ')
    expect(leg.distanceKm).toBe(42)
  })
  it('ClampsBadInputs', () => {
    const leg = buildLeg({ ...form, durationMin: -5, distanceKm: Number.NaN }, now)
    expect(leg.endMs - leg.startMs).toBe(0)
    expect(leg.distanceKm).toBe(0)
  })
})

describe('travelNote', () => {
  it('FormatsRouteDistanceAndMode', () => {
    expect(travelNote(buildLeg(form, now))).toBe('Travel: Home Office → Client HQ (42 km, car)')
  })
  it('OmitsDistanceWhenZero', () => {
    expect(travelNote(buildLeg({ ...form, distanceKm: 0 }, now))).toBe(
      'Travel: Home Office → Client HQ (car)',
    )
  })
})

describe('returnForm', () => {
  it('SwapsEndpointsKeepingDistanceAndMode', () => {
    const r = returnForm({ ...form, mode: 'train' })
    expect(r.from).toBe('Client HQ')
    expect(r.to).toBe('Home Office')
    expect(r.distanceKm).toBe(42)
    expect(r.mode).toBe('train')
  })
})

describe('previewLeg', () => {
  it('DiscountsCarTimeToHalfWorktime', () => {
    const p = previewLeg(form)
    expect(p.appliedFraction).toBe(0.5)
    expect(p.worktimeMs).toBe(30 * 60_000) // 60 min × 50%
    expect(p.distanceMinor).toBe(42 * 30) // 42 km × 0.30
    expect(p.isFullWorktime).toBe(false)
  })
  it('CountsATrainAsFullWorktime', () => {
    const p = previewLeg({ ...form, mode: 'train' })
    expect(p.appliedFraction).toBe(1)
    expect(p.isFullWorktime).toBe(true)
    expect(p.worktimeMs).toBe(60 * 60_000)
  })
})
