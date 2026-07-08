import { describe, expect, it } from 'vitest'
import { autoTrimOverlaps, findOverlaps, hasOverlaps, stopRunningAt } from './overlap.js'
import type { TimeEntry } from './time-entry.js'

function entry(
  id: string,
  start: number,
  end: number | null,
  extra: Partial<TimeEntry> = {},
): TimeEntry {
  return { id, start, end, billable: true, source: 'timer', ...extra }
}

describe('findOverlaps', () => {
  it('FindOverlaps_OverlappingPair_ReportsInterval', () => {
    expect(findOverlaps([entry('a', 0, 100), entry('b', 50, 150)])).toEqual([
      { earlier: 'a', later: 'b', overlapStart: 50, overlapEnd: 100 },
    ])
  })

  it('FindOverlaps_TouchingBoundary_NoOverlap', () => {
    expect(findOverlaps([entry('a', 0, 100), entry('b', 100, 200)])).toEqual([])
  })

  it('FindOverlaps_RunningEntry_Excluded', () => {
    expect(findOverlaps([entry('a', 0, null), entry('b', 50, 150)])).toEqual([])
  })

  it('FindOverlaps_ContainedEntry_Reported', () => {
    expect(findOverlaps([entry('a', 0, 200), entry('b', 50, 100)])).toEqual([
      { earlier: 'a', later: 'b', overlapStart: 50, overlapEnd: 100 },
    ])
  })
})

describe('hasOverlaps', () => {
  it('HasOverlaps_ReflectsFindOverlaps', () => {
    expect(hasOverlaps([entry('a', 0, 100), entry('b', 50, 150)])).toBe(true)
    expect(hasOverlaps([entry('a', 0, 100), entry('b', 100, 150)])).toBe(false)
  })
})

describe('autoTrimOverlaps', () => {
  it('AutoTrim_SequentialOverlap_TrimsEarlierEnd', () => {
    const trimmed = autoTrimOverlaps([entry('a', 0, 120), entry('b', 100, 200)])
    expect(trimmed.map(e => [e.id, e.end])).toEqual([
      ['a', 100],
      ['b', 200],
    ])
  })

  it('AutoTrim_NoOverlap_Unchanged', () => {
    expect(autoTrimOverlaps([entry('a', 0, 100), entry('b', 100, 200)]).map(e => e.end)).toEqual([
      100, 200,
    ])
  })

  it('AutoTrim_RunningEntry_PassesThrough', () => {
    expect(autoTrimOverlaps([entry('a', 0, null)])[0]?.end).toBeNull()
  })

  it('AutoTrim_EqualStarts_LeavesEndsUntouched', () => {
    // Two entries at the same start: trimming to next.start would zero one out,
    // so the `next.start > e.start` guard leaves both ends as-is.
    const trimmed = autoTrimOverlaps([entry('a', 0, 100), entry('b', 0, 200)])

    expect(trimmed.map(e => e.end)).toEqual([100, 200])
  })

  it('AutoTrim_RunningBeforeCompleted_PassesRunningThrough', () => {
    const trimmed = autoTrimOverlaps([entry('a', 0, null), entry('b', 50, 150)])

    expect(trimmed.map(e => [e.id, e.end])).toEqual([
      ['a', null],
      ['b', 150],
    ])
  })
})

describe('stopRunningAt', () => {
  it('StopRunningAt_RunningEntry_GetsEnd', () => {
    const stopped = stopRunningAt([entry('a', 0, null), entry('b', 0, 50)], 200)
    expect(stopped[0]?.end).toBe(200)
    expect(stopped[1]?.end).toBe(50)
  })

  it('StopRunningAt_RunningAfterNewStart_Untouched', () => {
    expect(stopRunningAt([entry('a', 300, null)], 200)[0]?.end).toBeNull()
  })
})
