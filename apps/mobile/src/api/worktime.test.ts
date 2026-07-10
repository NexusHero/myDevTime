import { describe, expect, it } from 'vitest'
import {
  clockIn,
  clockOut,
  fetchWorktimeSummary,
  getRunningShift,
  listShifts,
  parseOvertime,
  parseRunning,
  parseShift,
} from './worktime.js'

const jsonFetch = (body: unknown, seen?: string[]): typeof fetch =>
  ((url: string) => {
    seen?.push(url)
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  }) as unknown as typeof fetch

const SHIFT = {
  id: 's1',
  startedAt: '2026-07-06T08:00:00.000Z',
  endedAt: '2026-07-06T16:00:00.000Z',
  breakMs: 600_000,
  source: 'manual',
  breakShortfallMs: 1_200_000,
}
const OPEN = {
  id: 's2',
  startedAt: '2026-07-07T08:00:00.000Z',
  endedAt: null,
  breakMs: 0,
  source: 'clock',
}

/**
 * The worktime client reads the `/api/worktime/summary` response — the overtime
 * balance (net worked vs the target schedule) the deterministic core computes.
 * These pin the DTO parse and the request path + window query.
 */
const SUMMARY = { workedMs: 42_500_000, targetMs: 40_000_000, balanceMs: 2_500_000 }

describe('parseOvertime', () => {
  it('ReadsWorkedTargetAndBalance', () => {
    const o = parseOvertime(SUMMARY)
    expect(o.workedMs).toBe(42_500_000)
    expect(o.targetMs).toBe(40_000_000)
    expect(o.balanceMs).toBe(2_500_000)
  })
  it('KeepsANegativeBalance', () => {
    expect(
      parseOvertime({ workedMs: 0, targetMs: 40_000_000, balanceMs: -40_000_000 }).balanceMs,
    ).toBe(-40_000_000)
  })
  it('MalformedPayload_Throws', () => {
    expect(() => parseOvertime({ workedMs: 'x' })).toThrow()
    expect(() => parseOvertime(null)).toThrow()
  })
})

describe('fetchWorktimeSummary', () => {
  it('GetsSummaryWithWindowQuery', async () => {
    const seen: string[] = []
    const o = await fetchWorktimeSummary(
      'http://api',
      { from: '2026-07-06T00:00:00.000Z', to: '2026-07-13T00:00:00.000Z', tz: 'UTC' },
      jsonFetch(SUMMARY, seen),
    )
    expect(o.balanceMs).toBe(2_500_000)
    expect(seen[0]).toContain('/api/worktime/summary?')
    expect(seen[0]).toContain('tz=UTC')
  })
})

describe('parseShift / parseRunning', () => {
  it('ReadsAShiftWithItsBreakShortfall', () => {
    const s = parseShift(SHIFT)
    expect(s.endedAt).toBe('2026-07-06T16:00:00.000Z')
    expect(s.breakShortfallMs).toBe(1_200_000)
  })
  it('RunningIsNullWhenClockedOut', () => {
    expect(parseRunning(null)).toBeNull()
    expect(parseRunning(OPEN)?.endedAt).toBeNull()
  })
})

describe('punch-clock requests', () => {
  it('GetsRunningShift', async () => {
    const seen: string[] = []
    const s = await getRunningShift('http://api', jsonFetch(OPEN, seen))
    expect(s?.id).toBe('s2')
    expect(seen[0]).toContain('/api/worktime/running')
  })
  it('ListsShiftsWithWindowQuery', async () => {
    const seen: string[] = []
    const list = await listShifts(
      'http://api',
      { from: '2026-07-06T00:00:00.000Z', to: '2026-07-13T00:00:00.000Z' },
      jsonFetch([SHIFT], seen),
    )
    expect(list[0]?.id).toBe('s1')
    expect(seen[0]).toContain('/api/worktime/shifts?')
  })
  it('ClockInPostsAndReturnsTheOpenShift', async () => {
    const seen: string[] = []
    const s = await clockIn('http://api', jsonFetch(OPEN, seen))
    expect(s.endedAt).toBeNull()
    expect(seen[0]).toContain('/api/worktime/clock-in')
  })
  it('ClockOutPostsAndReturnsTheClosedShift', async () => {
    const seen: string[] = []
    const s = await clockOut('http://api', 600_000, jsonFetch(SHIFT, seen))
    expect(s.endedAt).not.toBeNull()
    expect(seen[0]).toContain('/api/worktime/clock-out')
  })
})
