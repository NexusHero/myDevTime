// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { HEAVY_LOAD_SCORE, MIN_BASELINE_DAYS } from '@mydevtime/domain'
import { liveLoadInputFrom } from './useLiveLoad.js'
import type { Shift } from '../api/worktime.js'
import type { LoadHistoryDay } from '../api/loadHistory.js'

/**
 * Unit tests for the pure `liveLoadInputFrom` derivation (ADR-0071, REQ-067): the
 * mapping from the client's real worktime + load-history state to the domain
 * `LiveLoadInput` is tested without rendering — the hook around it only adds the
 * fetch + tick. The derivation must stay honest: absent signals are 0 / +∞, never
 * guessed (the H3 rule the whole Sevi core rests on).
 */

const HOUR = 3_600_000

/** A local-time instant today at `hoursAgo` before `now`, as an ISO string. */
function iso(now: number, hoursAgo: number): string {
  return new Date(now - hoursAgo * HOUR).toISOString()
}

function completedShift(
  now: number,
  opts: { startHoursAgo: number; endHoursAgo: number; breakMs?: number; breakShortfallMs?: number },
): Shift {
  return {
    id: `s-${String(opts.startHoursAgo)}`,
    startedAt: iso(now, opts.startHoursAgo),
    endedAt: iso(now, opts.endHoursAgo),
    breakMs: opts.breakMs ?? 0,
    source: 'clock',
    breakShortfallMs: opts.breakShortfallMs ?? 0,
  }
}

function runningShift(
  now: number,
  opts: { startHoursAgo: number; breakMs?: number; breakShortfallMs?: number },
): Shift {
  return {
    id: 'running',
    startedAt: iso(now, opts.startHoursAgo),
    endedAt: null,
    breakMs: opts.breakMs ?? 0,
    source: 'clock',
    breakShortfallMs: opts.breakShortfallMs ?? 0,
  }
}

/** Noon local time today — every shift in these tests fits inside one local day. */
function localNoon(): number {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  return d.getTime()
}

/** `days` history entries oldest→newest, all at `score`. */
function flatHistory(days: number, score: number): LoadHistoryDay[] {
  return Array.from({ length: days }, (_, i) => ({ loadScore: score, weekday: i % 7 }))
}

describe('liveLoadInputFrom', () => {
  it('CompletedShiftsToday_WorkedMs_SumsNetDurations', () => {
    const now = localNoon()
    const input = liveLoadInputFrom({
      now,
      running: null,
      shifts: [
        completedShift(now, { startHoursAgo: 11, endHoursAgo: 8, breakMs: 0.5 * HOUR }), // net 2.5 h
        completedShift(now, { startHoursAgo: 7, endHoursAgo: 5 }), // net 2 h
      ],
      history: null,
    })
    expect(input.workedMsToday).toBe(4.5 * HOUR)
    expect(input.focusMsSinceBreak).toBe(0)
  })

  it('RunningShift_WorkedAndFocus_AddElapsedMinusBreaks', () => {
    const now = localNoon()
    const input = liveLoadInputFrom({
      now,
      running: runningShift(now, { startHoursAgo: 3, breakMs: 0.5 * HOUR }),
      shifts: [],
      history: null,
    })
    expect(input.workedMsToday).toBe(2.5 * HOUR)
    expect(input.focusMsSinceBreak).toBe(2.5 * HOUR)
  })

  it('RunningShift_BreakShortfallFlagged_DoesNotLetShortBreaksResetTheRun', () => {
    const now = localNoon()
    const input = liveLoadInputFrom({
      now,
      running: runningShift(now, {
        startHoursAgo: 4,
        breakMs: 0.25 * HOUR,
        breakShortfallMs: 15 * 60_000,
      }),
      shifts: [],
      history: null,
    })
    // Worked time still nets out the recorded break; the focus run does not — the
    // server has flagged the breaks as legally insufficient (ArbZG §4).
    expect(input.workedMsToday).toBe(3.75 * HOUR)
    expect(input.focusMsSinceBreak).toBe(4 * HOUR)
  })

  it('ShiftEndedYesterday_IsNotCountedToday', () => {
    const now = localNoon()
    const input = liveLoadInputFrom({
      now,
      running: null,
      shifts: [completedShift(now, { startHoursAgo: 30, endHoursAgo: 26 })],
      history: null,
    })
    expect(input.workedMsToday).toBe(0)
  })

  it('CrossMidnightShift_CountsOnTheDayItEnded', () => {
    // 04:00 local: a shift that started yesterday 22:00 and ended 03:00 today
    // belongs to today (a shift lands on the day you clock out).
    const d = new Date()
    d.setHours(4, 0, 0, 0)
    const now = d.getTime()
    const input = liveLoadInputFrom({
      now,
      running: null,
      shifts: [completedShift(now, { startHoursAgo: 6, endHoursAgo: 1 })],
      history: null,
    })
    expect(input.workedMsToday).toBe(5 * HOUR)
  })

  it('NoMeetingFeedAndNoTodayOvertime_AreZero_NeverGuessed', () => {
    const now = localNoon()
    const input = liveLoadInputFrom({ now, running: null, shifts: [], history: null })
    expect(input.backToBackMeetings).toBe(0)
    expect(input.overtimeMsToday).toBe(0)
  })

  it('HistoryAbsent_BaselineIsWideOpen_AndNoHeavyRun', () => {
    const now = localNoon()
    const input = liveLoadInputFrom({ now, running: null, shifts: [], history: null })
    expect(input.baselineNormalHigh).toBe(Number.POSITIVE_INFINITY)
    expect(input.consecutiveHeavyDays).toBe(0)
  })

  it('ShortHistory_NoHeavyRunVerdict_EvenWhenEveryDayIsHeavy', () => {
    const now = localNoon()
    const input = liveLoadInputFrom({
      now,
      running: null,
      shifts: [],
      history: flatHistory(MIN_BASELINE_DAYS - 1, HEAVY_LOAD_SCORE + 1),
    })
    expect(input.baselineNormalHigh).toBe(Number.POSITIVE_INFINITY)
    expect(input.consecutiveHeavyDays).toBe(0)
  })

  it('LongHistory_TrailingHeavyRun_CountsOnlyTheRunEndingYesterday', () => {
    const now = localNoon()
    const history: LoadHistoryDay[] = [
      ...flatHistory(4, HEAVY_LOAD_SCORE + 2), // an old heavy stretch, broken below
      { loadScore: 0, weekday: 4 },
      { loadScore: HEAVY_LOAD_SCORE, weekday: 5 },
      { loadScore: HEAVY_LOAD_SCORE + 1, weekday: 6 },
    ]
    const input = liveLoadInputFrom({ now, running: null, shifts: [], history })
    expect(input.consecutiveHeavyDays).toBe(2)
    expect(Number.isFinite(input.baselineNormalHigh)).toBe(true)
  })

  it('Now_IsPassedThroughVerbatim', () => {
    const now = localNoon()
    expect(liveLoadInputFrom({ now, running: null, shifts: [], history: null }).now).toBe(now)
  })
})
