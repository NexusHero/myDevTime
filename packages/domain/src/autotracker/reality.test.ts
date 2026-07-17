import { describe, expect, it } from 'vitest'
import {
  detectUnbookedGap,
  realityDrift,
  trackedMs,
  type BookedSpan,
  type TimedSpan,
} from './reality.js'

const M = 60_000 // one minute in ms

/** Build a span from minute offsets, for readable tests. */
function span(source: string, startMin: number, endMin: number): TimedSpan {
  return { source, startMs: startMin * M, endMs: endMin * M }
}
function booked(startMin: number, endMin: number): BookedSpan {
  return { startMs: startMin * M, endMs: endMin * M }
}

describe('trackedMs', () => {
  it('SumsActiveSpans_ExcludingIdleAndAway', () => {
    const spans = [span('VS Code', 0, 30), span('Idle', 30, 45), span('Chrome', 45, 60)]
    // 30 + 15 min active; the 15-min Idle span is excluded.
    expect(trackedMs(spans)).toBe(45 * M)
  })

  it('IgnoresNonPositiveSpans', () => {
    expect(trackedMs([span('VS Code', 30, 30), span('VS Code', 40, 20)])).toBe(0)
  })

  it('HonoursACustomIdleSet', () => {
    const spans = [span('VS Code', 0, 30), span('Slack', 30, 45)]
    expect(trackedMs(spans, { idleSources: ['Slack'] })).toBe(30 * M)
  })
})

describe('realityDrift', () => {
  it('PositiveWhenTrackedExceedsBooked', () => {
    const spans = [span('VS Code', 0, 120)] // 2h tracked
    const d = realityDrift(spans, 90 * M) // 1.5h booked
    expect(d).toEqual({ trackedMs: 120 * M, bookedMs: 90 * M, deltaMs: 30 * M })
  })

  it('NegativeWhenBookedExceedsTracked', () => {
    const d = realityDrift([span('VS Code', 0, 60)], 120 * M)
    expect(d.deltaMs).toBe(-60 * M)
  })

  it('ClampsNegativeBookedToZero', () => {
    expect(realityDrift([], -5 * M).bookedMs).toBe(0)
  })
})

describe('detectUnbookedGap', () => {
  const minGapMs = 15 * M

  it('ReturnsNull_WhenAllActivityIsBooked', () => {
    const spans = [span('VS Code', 0, 60)]
    expect(detectUnbookedGap(spans, [booked(0, 60)], { minGapMs })).toBeNull()
  })

  it('FindsTheUnbookedStretch_LabelledByDominantSource', () => {
    // Tracker saw 09:00–10:00 VS Code; only 09:00–09:20 was booked → 09:20–10:00 open.
    const spans = [span('VS Code', 0, 60)]
    const gap = detectUnbookedGap(spans, [booked(0, 20)], { minGapMs })
    expect(gap).toEqual({ startMs: 20 * M, endMs: 60 * M, source: 'VS Code' })
  })

  it('IgnoresIdleTime_WhenDecidingWhatIsUnbooked', () => {
    // A 40-min Idle span is not "work", so it never becomes a healing candidate.
    const spans = [span('Idle', 0, 40), span('VS Code', 40, 50)]
    // The only active stretch (40–50, 10 min) is under the 15-min floor → null.
    expect(detectUnbookedGap(spans, [], { minGapMs })).toBeNull()
  })

  it('DropsGapsBelowTheMinimum', () => {
    const spans = [span('VS Code', 0, 10)] // 10 min < 15-min floor
    expect(detectUnbookedGap(spans, [], { minGapMs })).toBeNull()
  })

  it('PicksTheLongestGap_WhenThereAreSeveral', () => {
    // Two unbooked stretches: 0–20 (20 min) and 40–100 (60 min). The longer wins.
    const spans = [span('VS Code', 0, 20), span('Chrome', 40, 100)]
    const gap = detectUnbookedGap(spans, [], { minGapMs })
    expect(gap).toEqual({ startMs: 40 * M, endMs: 100 * M, source: 'Chrome' })
  })

  it('LabelsByTheSourceWithTheMostMsInsideTheGap', () => {
    // In 0–60 unbooked: Chrome 0–40 (40 min) beats VS Code 40–60 (20 min).
    const spans = [span('Chrome', 0, 40), span('VS Code', 40, 60)]
    const gap = detectUnbookedGap(spans, [], { minGapMs })
    expect(gap?.source).toBe('Chrome')
  })
})
