import { afterEach, describe, expect, it } from 'vitest'
import {
  nudgesSentToday,
  recordNudge,
  resetNudgeBudget,
  SEVI_DAILY_CAP,
  tryClaimNudge,
} from './nudgeBudget.js'

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

  // The atomic check+increment: two surfaces racing within one commit can never both win the
  // last slot — a separate render-time check plus a later record could.
  it('TryClaim_UnderCap_ClaimsAndIncrements', () => {
    const noon = new Date(2026, 6, 20, 12).getTime()
    expect(tryClaimNudge(noon, SEVI_DAILY_CAP)).toBe(true)
    expect(nudgesSentToday(noon)).toBe(1)
  })

  it('TryClaim_AtCap_RefusesWithoutIncrementing', () => {
    const noon = new Date(2026, 6, 20, 12).getTime()
    for (let i = 0; i < SEVI_DAILY_CAP; i += 1) recordNudge(noon)
    expect(tryClaimNudge(noon, SEVI_DAILY_CAP)).toBe(false)
    expect(nudgesSentToday(noon)).toBe(SEVI_DAILY_CAP)
  })

  it('TryClaim_ExactlyOneWinner_ForTheLastSlot', () => {
    const noon = new Date(2026, 6, 20, 12).getTime()
    for (let i = 0; i < SEVI_DAILY_CAP - 1; i += 1) recordNudge(noon)
    // Two surfaces attempt in the same commit: the first claim wins, the second is refused.
    expect(tryClaimNudge(noon, SEVI_DAILY_CAP)).toBe(true)
    expect(tryClaimNudge(noon, SEVI_DAILY_CAP)).toBe(false)
    expect(nudgesSentToday(noon)).toBe(SEVI_DAILY_CAP)
  })

  it('TryClaim_AfterDayRollover_ClaimsAgainstTheFreshBudget', () => {
    const monday = new Date(2026, 6, 20, 23).getTime()
    const tuesday = new Date(2026, 6, 21, 1).getTime()
    for (let i = 0; i < SEVI_DAILY_CAP; i += 1) recordNudge(monday)
    expect(tryClaimNudge(monday, SEVI_DAILY_CAP)).toBe(false)
    expect(tryClaimNudge(tuesday, SEVI_DAILY_CAP)).toBe(true)
    expect(nudgesSentToday(tuesday)).toBe(1)
  })
})
