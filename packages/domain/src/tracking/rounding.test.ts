import { describe, expect, it } from 'vitest'
import { NO_ROUNDING, roundDuration, type RoundingIncrementMinutes } from './rounding.js'
import { MINUTE_MS } from './time.js'

const min = (n: number): number => n * MINUTE_MS

describe('roundDuration', () => {
  it('Round_NoneMode_ReturnsExact', () => {
    expect(roundDuration(min(7) + 123, NO_ROUNDING)).toBe(min(7) + 123)
  })

  it('Round_NearestExactMidpoint_RoundsUp', () => {
    // 7m30s at a 15-min increment sits exactly on the midpoint → 15 min.
    expect(roundDuration(min(7) + 30_000, { mode: 'nearest', incrementMinutes: 15 })).toBe(min(15))
  })

  it('Round_NearestBelowMidpoint_RoundsDown', () => {
    expect(roundDuration(min(7), { mode: 'nearest', incrementMinutes: 15 })).toBe(0)
  })

  it('Round_UpMode_AlwaysCeils', () => {
    expect(roundDuration(min(1), { mode: 'up', incrementMinutes: 15 })).toBe(min(15))
    expect(roundDuration(min(16), { mode: 'up', incrementMinutes: 15 })).toBe(min(30))
  })

  it('Round_ExactMultiple_Unchanged', () => {
    expect(roundDuration(min(30), { mode: 'up', incrementMinutes: 15 })).toBe(min(30))
    expect(roundDuration(min(30), { mode: 'nearest', incrementMinutes: 15 })).toBe(min(30))
  })

  it.each([1, 5, 6, 15, 30, 60] as RoundingIncrementMinutes[])(
    'Round_Increment%s_SnapsToGrid',
    inc => {
      expect(roundDuration(min(inc) + 1, { mode: 'up', incrementMinutes: inc }) % min(inc)).toBe(0)
    },
  )

  it('Round_Negative_Throws', () => {
    expect(() => roundDuration(-1, NO_ROUNDING)).toThrow(/negative/)
  })
})
