import { describe, expect, it } from 'vitest'
import { summarizeActivity, type ActivitySample } from './activity.js'

const S = 1000
const MIN = 60 * S

function sample(source: string, ms: number): ActivitySample {
  return { source, ms }
}

describe('summarizeActivity', () => {
  it('MergesSamplesBySource_AndSumsMs', () => {
    const out = summarizeActivity([
      sample('myDevTime', 10 * MIN),
      sample('Away', 4 * MIN),
      sample('myDevTime', 6 * MIN),
    ])
    expect(out.totalMs).toBe(20 * MIN)
    expect(out.segments.map(s => [s.source, s.ms])).toEqual([
      ['myDevTime', 16 * MIN],
      ['Away', 4 * MIN],
    ])
  })

  it('SortsSegmentsByMsDescending', () => {
    const out = summarizeActivity([
      sample('a', 1 * MIN),
      sample('b', 3 * MIN),
      sample('c', 2 * MIN),
    ])
    expect(out.segments.map(s => s.source)).toEqual(['b', 'c', 'a'])
  })

  it('PercentagesSumTo100_ViaLargestRemainder', () => {
    // 1/3 each → 33,33,34 (largest remainder gives the odd point to one bucket).
    const out = summarizeActivity([
      sample('a', 1 * MIN),
      sample('b', 1 * MIN),
      sample('c', 1 * MIN),
    ])
    const total = out.segments.reduce((n, s) => n + s.pct, 0)
    expect(total).toBe(100)
    expect([...out.segments.map(s => s.pct)].sort((x, y) => x - y)).toEqual([33, 33, 34])
  })

  it('EmptyInput_ReturnsEmptyBreakdown', () => {
    const out = summarizeActivity([])
    expect(out).toEqual({ totalMs: 0, segments: [] })
  })

  it('ZeroTotal_ReturnsEmptyBreakdown', () => {
    expect(summarizeActivity([sample('a', 0), sample('b', 0)])).toEqual({
      totalMs: 0,
      segments: [],
    })
  })

  it('SkipsNonPositiveSamples', () => {
    const out = summarizeActivity([sample('a', 5 * MIN), sample('b', 0), sample('c', -3 * MIN)])
    expect(out.totalMs).toBe(5 * MIN)
    expect(out.segments.map(s => s.source)).toEqual(['a'])
    expect(out.segments[0]?.pct).toBe(100)
  })

  it('TieBreaksBySourceName_ForDeterministicOrder', () => {
    const out = summarizeActivity([sample('zebra', 2 * MIN), sample('alpha', 2 * MIN)])
    expect(out.segments.map(s => s.source)).toEqual(['alpha', 'zebra'])
  })

  it('TopN_FoldsTheTailIntoOthers', () => {
    const out = summarizeActivity(
      [sample('a', 50 * MIN), sample('b', 30 * MIN), sample('c', 12 * MIN), sample('d', 8 * MIN)],
      { topN: 2 },
    )
    expect(out.segments.map(s => s.source)).toEqual(['a', 'b', 'Others'])
    expect(out.segments.find(s => s.source === 'Others')?.ms).toBe(20 * MIN)
    expect(out.segments.reduce((n, s) => n + s.pct, 0)).toBe(100)
  })

  it('TopN_NoTail_LeavesSegmentsUnfolded', () => {
    const out = summarizeActivity([sample('a', 2 * MIN), sample('b', 1 * MIN)], { topN: 3 })
    expect(out.segments.map(s => s.source)).toEqual(['a', 'b'])
  })

  it('TopN_UsesCustomOthersLabel', () => {
    const out = summarizeActivity(
      [sample('a', 3 * MIN), sample('b', 2 * MIN), sample('c', 1 * MIN)],
      { topN: 1, othersLabel: 'Rest' },
    )
    expect(out.segments.map(s => s.source)).toEqual(['a', 'Rest'])
  })
})
