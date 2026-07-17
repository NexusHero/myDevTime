import { describe, expect, it } from 'vitest'
import { timesheetDrafts, type BookedSpan, type TimedSpan } from './reality.js'

const MIN = 60_000

/**
 * Acceptance for the KI6 timesheet-draft builder (REQ-062, design v17 §K). "Your day, already
 * written": every unbooked active tracker stretch ≥ the floor becomes a bookable draft labelled
 * by its dominant source — a review queue, never auto-booked (ADR-0005). Pure and deterministic.
 */
describe('timesheetDrafts', () => {
  it('DraftsEveryUnbookedActiveStretchAboveTheFloor', () => {
    const spans: TimedSpan[] = [
      { source: 'VS Code', startMs: 0, endMs: 60 * MIN }, // 0:00–1:00
      { source: 'Slack', startMs: 90 * MIN, endMs: 120 * MIN }, // 1:30–2:00
    ]
    const booked: BookedSpan[] = [] // nothing booked → both are drafts
    const res = timesheetDrafts(spans, booked, { minDraftMs: 15 * MIN })
    expect(res.drafts).toEqual([
      { startMs: 0, endMs: 60 * MIN, durationMs: 60 * MIN, source: 'VS Code' },
      { startMs: 90 * MIN, endMs: 120 * MIN, durationMs: 30 * MIN, source: 'Slack' },
    ])
    expect(res.recoveredMs).toBe(90 * MIN)
  })

  it('SubtractsBookedTime_OnlyTheUnbookedRemainderBecomesADraft', () => {
    const spans: TimedSpan[] = [{ source: 'VS Code', startMs: 0, endMs: 120 * MIN }]
    const booked: BookedSpan[] = [{ startMs: 0, endMs: 60 * MIN }] // first hour booked
    const res = timesheetDrafts(spans, booked, { minDraftMs: 15 * MIN })
    expect(res.drafts).toEqual([
      { startMs: 60 * MIN, endMs: 120 * MIN, durationMs: 60 * MIN, source: 'VS Code' },
    ])
  })

  it('DropsStretchesBelowTheFloorAndIdleSources', () => {
    const spans: TimedSpan[] = [
      { source: 'VS Code', startMs: 0, endMs: 10 * MIN }, // 10 min < floor → dropped
      { source: 'Idle', startMs: 20 * MIN, endMs: 200 * MIN }, // idle → never a draft
    ]
    expect(timesheetDrafts(spans, [], { minDraftMs: 15 * MIN }).drafts).toEqual([])
  })

  it('LabelsAStretchWithItsDominantSource', () => {
    const spans: TimedSpan[] = [
      { source: 'VS Code', startMs: 0, endMs: 50 * MIN }, // 50 min
      { source: 'Chrome', startMs: 50 * MIN, endMs: 60 * MIN }, // 10 min → VS Code dominates
    ]
    const res = timesheetDrafts(spans, [], { minDraftMs: 15 * MIN })
    expect(res.drafts).toHaveLength(1)
    expect(res.drafts[0]?.source).toBe('VS Code')
  })

  it('RecoversNothingWhenEveryStretchIsBooked', () => {
    const spans: TimedSpan[] = [{ source: 'VS Code', startMs: 0, endMs: 60 * MIN }]
    const booked: BookedSpan[] = [{ startMs: 0, endMs: 60 * MIN }]
    expect(timesheetDrafts(spans, booked, { minDraftMs: 15 * MIN })).toEqual({
      drafts: [],
      recoveredMs: 0,
    })
  })
})
