import { afterEach, describe, expect, it } from 'vitest'
import { nudgesSentToday, recordNudge, resetNudgeBudget, SEVI_DAILY_CAP } from './nudgeBudget.js'

/**
 * The shared daily nudge budget (ADR-0071 P2): one counter per device-local day across ALL
 * Sevi surfaces, so the ≤SEVI_DAILY_CAP guarantee holds even when two voices are active.
 */
describe('nudgeBudget', () => {
  afterEach(() => {
    resetNudgeBudget()
  })

  it('FreshDay_HasZeroSent', () => {
    expect(nudgesSentToday(Date.UTC(2026, 6, 20, 12))).toBe(0)
  })

  it('RecordNudge_CountsAgainstTheSameDay_AcrossSurfaces', () => {
    const noon = new Date(2026, 6, 20, 12).getTime()
    recordNudge(noon)
    recordNudge(noon)
    expect(nudgesSentToday(noon)).toBe(2)
    expect(nudgesSentToday(noon)).toBeGreaterThanOrEqual(SEVI_DAILY_CAP)
  })

  it('ANewDay_StartsAFreshBudget', () => {
    const monday = new Date(2026, 6, 20, 23).getTime()
    const tuesday = new Date(2026, 6, 21, 1).getTime()
    recordNudge(monday)
    expect(nudgesSentToday(monday)).toBe(1)
    expect(nudgesSentToday(tuesday)).toBe(0)
  })
})
