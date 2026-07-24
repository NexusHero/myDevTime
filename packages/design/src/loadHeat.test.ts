import { describe, expect, it } from 'vitest'
import { loadHeat } from './planner.js'

/**
 * loadHeat (issues #366/#367) — the shared 5-step accent heat scale for the calendar
 * (month + year). It mirrors the existing `loadTone` bands but with finer granularity,
 * bucketing a day's prio-weighted load against its daily target into five levels:
 * `0` idle · `1` sunk (≤50%) · `2` soft (≤85%) · `3` text (≤100%) · `4` accent (over).
 * Pure so the calendar's heat is deterministic (ADR-0005); the color is decorative, the
 * a11y label carries the meaning (REQ-043).
 */
describe('loadHeat', () => {
  it('Idle_WhenNoLoad', () => {
    expect(loadHeat(0, 8)).toBe(0)
    expect(loadHeat(-1, 8)).toBe(0)
  })

  it('Level1_Sunk_WhenUnderHalfTarget', () => {
    expect(loadHeat(1, 8)).toBe(1)
    expect(loadHeat(4, 8)).toBe(1) // exactly 50% → level 1
  })

  it('Level2_Soft_WhenUnder85Percent', () => {
    expect(loadHeat(4.1, 8)).toBe(2)
    expect(loadHeat(6.8, 8)).toBe(2) // exactly 85% → level 2
  })

  it('Level3_Text_WhenUnderOrAtTarget', () => {
    expect(loadHeat(6.9, 8)).toBe(3)
    expect(loadHeat(8, 8)).toBe(3) // exactly 100% → level 3
  })

  it('Level4_Accent_WhenOverTarget', () => {
    expect(loadHeat(8.1, 8)).toBe(4)
    expect(loadHeat(12, 8)).toBe(4)
  })

  it('AnyLoadWithNoTarget_IsAccent', () => {
    // A non-positive target means there is nothing to measure against — any load is "over".
    expect(loadHeat(1, 0)).toBe(4)
    expect(loadHeat(1, -1)).toBe(4)
  })
})
