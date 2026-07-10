import { describe, expect, it } from 'vitest'
import { fetchWorktimeSummary, parseOvertime } from './worktime.js'

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
    const fetchImpl = ((url: string) => {
      seen.push(url)
      return Promise.resolve(new Response(JSON.stringify(SUMMARY), { status: 200 }))
    }) as unknown as typeof fetch
    const o = await fetchWorktimeSummary(
      'http://api',
      { from: '2026-07-06T00:00:00.000Z', to: '2026-07-13T00:00:00.000Z', tz: 'UTC' },
      fetchImpl,
    )
    expect(o.balanceMs).toBe(2_500_000)
    expect(seen[0]).toContain('/api/worktime/summary?')
    expect(seen[0]).toContain('tz=UTC')
  })
})
