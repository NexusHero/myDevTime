// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { summarizeActivity, type ActivitySample } from '@mydevtime/domain'
import { SpanAccumulator, WEB_SOURCE, nullCapture, webCapture } from './capture.js'

describe('SpanAccumulator', () => {
  it('EmitsThePreviousSpan_OnEachSourceTransition', () => {
    const out: ActivitySample[] = []
    const acc = new SpanAccumulator(s => out.push(s))
    acc.transition('Active', 0)
    acc.transition('Away', 10_000) // closes Active (10s)
    acc.transition('Active', 15_000) // closes Away (5s)
    acc.end(20_000) // closes Active (5s)
    expect(out).toEqual([
      { source: 'Active', ms: 10_000 },
      { source: 'Away', ms: 5_000 },
      { source: 'Active', ms: 5_000 },
    ])
  })

  it('IgnoresARedundantTransition_ToTheSameSource', () => {
    const out: ActivitySample[] = []
    const acc = new SpanAccumulator(s => out.push(s))
    acc.transition('Active', 0)
    acc.transition('Active', 5_000) // same source — no emit, span keeps running
    acc.end(8_000)
    expect(out).toEqual([{ source: 'Active', ms: 8_000 }])
  })

  it('Flush_EmitsElapsed_AndKeepsTheSpanOpen', () => {
    const out: ActivitySample[] = []
    const acc = new SpanAccumulator(s => out.push(s))
    acc.transition('Active', 0)
    acc.flush(30_000)
    acc.flush(60_000)
    acc.end(60_000) // nothing left since last flush
    expect(out).toEqual([
      { source: 'Active', ms: 30_000 },
      { source: 'Active', ms: 30_000 },
    ])
  })

  it('EmitsNothing_ForAZeroLengthSpan', () => {
    const out: ActivitySample[] = []
    const acc = new SpanAccumulator(s => out.push(s))
    acc.transition('Active', 1_000)
    acc.end(1_000) // no elapsed time
    expect(out).toEqual([])
  })

  it('AccumulatedSpans_SummarizeToTheExpectedBreakdown', () => {
    const out: ActivitySample[] = []
    const acc = new SpanAccumulator(s => out.push(s))
    acc.transition('Active', 0)
    acc.transition('Away', 45_000)
    acc.end(60_000)
    const bd = summarizeActivity(out)
    expect(bd.totalMs).toBe(60_000)
    expect(bd.segments).toEqual([
      { source: 'Active', ms: 45_000, pct: 75 },
      { source: 'Away', ms: 15_000, pct: 25 },
    ])
  })
})

describe('nullCapture', () => {
  it('EmitsNothing_AndStopIsSafe', () => {
    const out: ActivitySample[] = []
    const stop = nullCapture().start(s => out.push(s))
    stop()
    stop() // idempotent
    expect(out).toEqual([])
  })
})

describe('webCapture', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function setVisibility(state: 'visible' | 'hidden'): void {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  it('FlushingAnActiveTab_AccumulatesActiveTime', () => {
    let clock = 0
    setVisibility('visible')
    vi.useFakeTimers()
    const out: ActivitySample[] = []
    const stop = webCapture({ now: () => clock, flushMs: 30_000, idleMs: 60_000 }).start(s =>
      out.push(s),
    )
    clock = 30_000
    vi.advanceTimersByTime(30_000) // one flush tick
    stop()
    expect(summarizeActivity(out).segments[0]?.source).toBe(WEB_SOURCE.active)
    expect(summarizeActivity(out).totalMs).toBe(30_000)
  })

  it('HidingTheTab_SwitchesToAway', () => {
    let clock = 0
    setVisibility('visible')
    const out: ActivitySample[] = []
    const stop = webCapture({ now: () => clock }).start(s => out.push(s))
    clock = 10_000
    setVisibility('hidden') // closes the Active span
    clock = 25_000
    stop() // closes the Away span
    const bd = summarizeActivity(out)
    expect(bd.segments.map(s => s.source).sort()).toEqual([WEB_SOURCE.active, WEB_SOURCE.away])
    expect(bd.totalMs).toBe(25_000)
  })

  it('NoInputPastTheIdleThreshold_ReportsIdle', () => {
    let clock = 0
    setVisibility('visible')
    vi.useFakeTimers()
    const out: ActivitySample[] = []
    const stop = webCapture({ now: () => clock, flushMs: 30_000, idleMs: 60_000 }).start(s =>
      out.push(s),
    )
    clock = 70_000 // 70s with no input, past the 60s idle threshold
    vi.advanceTimersByTime(30_000) // flush re-evaluates the source → Idle
    clock = 80_000
    stop()
    expect(out.some(s => s.source === WEB_SOURCE.idle)).toBe(true)
  })

  it('AfterStop_NoFurtherSpansAreEmitted', () => {
    let clock = 0
    setVisibility('visible')
    const out: ActivitySample[] = []
    const stop = webCapture({ now: () => clock }).start(s => out.push(s))
    clock = 5_000
    stop()
    const countAfterStop = out.length
    clock = 20_000
    setVisibility('hidden') // listener detached — must not emit
    expect(out.length).toBe(countAfterStop)
  })
})
