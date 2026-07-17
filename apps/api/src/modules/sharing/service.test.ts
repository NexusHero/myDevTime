import { describe, expect, it } from 'vitest'
import { projectFreeBusy } from './service.js'

const H = 60 * 60 * 1000
const T0 = 1_700_000_000_000
const at = (ms: number) => new Date(ms)

/**
 * The window-bounded Free/Busy projection is the tested heart of the partner-light endpoint
 * (REQ-064). It reads only start/end, clamps a running timer to the window, clips busy to the
 * window, and yields the free gaps — no title/project/note ever participates.
 */
describe('projectFreeBusy', () => {
  const window = { startMs: T0, endMs: T0 + 8 * H }

  it('CompletedEntries_BecomeBusySpansAndFreeGaps', () => {
    const r = projectFreeBusy(
      [
        { startedAt: at(T0 + H), endedAt: at(T0 + 2 * H) },
        { startedAt: at(T0 + 4 * H), endedAt: at(T0 + 5 * H) },
      ],
      window,
    )
    expect(r.busy).toEqual([
      { startMs: T0 + H, endMs: T0 + 2 * H, state: 'busy' },
      { startMs: T0 + 4 * H, endMs: T0 + 5 * H, state: 'busy' },
    ])
    expect(r.free).toEqual([
      { startMs: T0, endMs: T0 + H },
      { startMs: T0 + 2 * H, endMs: T0 + 4 * H },
      { startMs: T0 + 5 * H, endMs: T0 + 8 * H },
    ])
  })

  it('RunningTimer_IsClampedToTheWindowEnd', () => {
    const r = projectFreeBusy([{ startedAt: at(T0 + 6 * H), endedAt: null }], window)
    expect(r.busy).toEqual([{ startMs: T0 + 6 * H, endMs: T0 + 8 * H, state: 'busy' }])
  })

  it('BusySpans_AreClippedToTheWindow', () => {
    const r = projectFreeBusy([{ startedAt: at(T0 - 3 * H), endedAt: at(T0 + 3 * H) }], window)
    expect(r.busy).toEqual([{ startMs: T0, endMs: T0 + 3 * H, state: 'busy' }])
    expect(r.free).toEqual([{ startMs: T0 + 3 * H, endMs: T0 + 8 * H }])
  })

  it('NoEntries_IsAFullyFreeWindow', () => {
    const r = projectFreeBusy([], window)
    expect(r.busy).toEqual([])
    expect(r.free).toEqual([{ startMs: T0, endMs: T0 + 8 * H }])
  })
})
