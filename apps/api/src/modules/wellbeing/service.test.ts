import { describe, expect, it } from 'vitest'
import { weekdayOf } from './service.js'

/**
 * The pure part of the wellbeing service (REQ-065): deriving a stable weekday from a stored
 * `'YYYY-MM-DD'` day, clock-free. `computeBaseline` only groups by weekday, so the exact encoding
 * matters less than its stability — these pin 0 = Sunday … 6 = Saturday and that it never drifts
 * with the host clock. The persistence itself is exercised against a real Postgres in the
 * companion integration suite (workspace isolation, upsert, oldest→newest ordering).
 */
describe('weekdayOf', () => {
  it('maps a known day to its weekday (0 = Sunday … 6 = Saturday)', () => {
    expect(weekdayOf('2026-07-19')).toBe(0) // a Sunday
    expect(weekdayOf('2026-07-20')).toBe(1) // Monday
    expect(weekdayOf('2026-07-24')).toBe(5) // Friday
    expect(weekdayOf('2026-07-25')).toBe(6) // Saturday
  })

  it('is clock-free — the same day string always yields the same weekday', () => {
    expect(weekdayOf('2000-01-01')).toBe(weekdayOf('2000-01-01'))
    expect(weekdayOf('2000-01-01')).toBe(6) // 2000-01-01 was a Saturday
  })
})
