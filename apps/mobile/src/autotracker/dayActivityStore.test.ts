import { afterEach, describe, expect, it } from 'vitest'
import type { TimedSpan } from '@mydevtime/domain'
import {
  KEEP_DAYS,
  appendDaySpans,
  clearDayHistory,
  loadDaySpans,
  localDayKey,
  mergeAdjacentSpans,
} from './dayActivityStore.js'

/**
 * Runs on the native/in-memory path (no `localStorage` in the node env) — the same
 * logic the web path stores. Spans are built with the *local* Date constructor so the
 * day key is timezone-independent.
 */
afterEach(() => {
  clearDayHistory()
})

/** A span inside a specific local calendar day, from minute offsets. */
function daySpan(
  year: number,
  monthIdx: number,
  day: number,
  source: string,
  fromMin: number,
  toMin: number,
): TimedSpan {
  const base = new Date(year, monthIdx, day, 0, 0, 0, 0).getTime()
  return { source, startMs: base + fromMin * 60_000, endMs: base + toMin * 60_000 }
}

describe('localDayKey', () => {
  it('MapsTwoTimesInTheSameLocalDay_ToTheSameKey', () => {
    const morning = new Date(2026, 0, 5, 8, 0).getTime()
    const evening = new Date(2026, 0, 5, 20, 0).getTime()
    expect(localDayKey(morning)).toBe(localDayKey(evening))
    expect(localDayKey(morning)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('MapsTheNextDay_ToADifferentKey', () => {
    expect(localDayKey(new Date(2026, 0, 5, 12).getTime())).not.toBe(
      localDayKey(new Date(2026, 0, 6, 12).getTime()),
    )
  })
})

describe('mergeAdjacentSpans', () => {
  it('MergesTouchingSameSourceSpans_AndSortsByStart', () => {
    const merged = mergeAdjacentSpans([
      { source: 'VS Code', startMs: 60_000, endMs: 120_000 },
      { source: 'VS Code', startMs: 0, endMs: 60_000 },
    ])
    expect(merged).toEqual([{ source: 'VS Code', startMs: 0, endMs: 120_000 }])
  })

  it('KeepsDifferentSourcesSeparate', () => {
    const merged = mergeAdjacentSpans([
      { source: 'VS Code', startMs: 0, endMs: 60_000 },
      { source: 'Chrome', startMs: 60_000, endMs: 120_000 },
    ])
    expect(merged).toHaveLength(2)
  })

  it('DropsNonPositiveSpans', () => {
    expect(mergeAdjacentSpans([{ source: 'X', startMs: 100, endMs: 100 }])).toEqual([])
  })
})

describe('appendDaySpans / loadDaySpans', () => {
  it('FilesSpansUnderTheirLocalDay_AndRoundTrips', () => {
    const s = daySpan(2026, 0, 5, 'VS Code', 540, 600) // 09:00–10:00
    appendDaySpans([s])
    expect(loadDaySpans(localDayKey(s.startMs))).toEqual([s])
  })

  it('AppendsAcrossCalls_MergingAdjacentSpans', () => {
    const a = daySpan(2026, 0, 5, 'VS Code', 540, 600)
    const b = daySpan(2026, 0, 5, 'VS Code', 600, 660) // touches a
    appendDaySpans([a])
    appendDaySpans([b])
    const key = localDayKey(a.startMs)
    expect(loadDaySpans(key)).toEqual([{ source: 'VS Code', startMs: a.startMs, endMs: b.endMs }])
  })

  it('SeparatesSpansThatFallOnDifferentDays', () => {
    const d5 = daySpan(2026, 0, 5, 'VS Code', 540, 600)
    const d6 = daySpan(2026, 0, 6, 'Chrome', 540, 600)
    appendDaySpans([d5, d6])
    expect(loadDaySpans(localDayKey(d5.startMs))).toEqual([d5])
    expect(loadDaySpans(localDayKey(d6.startMs))).toEqual([d6])
  })

  it('PrunesToTheNewestKEEP_DAYS', () => {
    // 9 distinct days; only the newest KEEP_DAYS survive.
    for (let day = 1; day <= 9; day++) {
      appendDaySpans([daySpan(2026, 0, day, 'VS Code', 540, 600)])
    }
    // Oldest two (Jan 1, Jan 2) pruned; Jan 3..9 kept.
    expect(loadDaySpans('2026-01-01')).toEqual([])
    expect(loadDaySpans('2026-01-02')).toEqual([])
    expect(loadDaySpans('2026-01-09')).toHaveLength(1)
    // Exactly KEEP_DAYS retained.
    let kept = 0
    for (let day = 1; day <= 9; day++) {
      if (loadDaySpans(`2026-01-${String(day).padStart(2, '0')}`).length > 0) kept++
    }
    expect(kept).toBe(KEEP_DAYS)
  })

  it('LoadsNothingForAnUnknownDay', () => {
    expect(loadDaySpans('1999-01-01')).toEqual([])
  })
})
