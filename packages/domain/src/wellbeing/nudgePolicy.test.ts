import { describe, expect, it } from 'vitest'
import { decideNudge, inQuietWindow, type NudgeContext } from './nudgePolicy.js'
import type { LiveLoad } from './liveLoad.js'

/**
 * Acceptance for the nudge delivery policy (ADR-0071 P2, REQ-069/057). Delivery is the
 * conjunction of every gate — speak-up load, opt-in, outside quiet hours (which may wrap
 * midnight), no 🛡 protected block, under the daily cap — and each suppression names its
 * reason with a fixed precedence. `digest` is true only for a speak-up held by quiet hours
 * or protection (the REQ-057 "one digest after" rule), never for calm/opt-out/cap.
 */

const speakUp: LiveLoad = { level: 'speak-up', reasons: ['no-break'], hardCapHit: true }
const calm: LiveLoad = { level: 'calm', reasons: [], hardCapHit: false }
const watch: LiveLoad = { level: 'watch', reasons: ['long-day'], hardCapHit: false }

/** A deliverable speak-up at 15:00 with default quiet hours (22:00→07:00); overrides gate it. */
function ctx(overrides: Partial<NudgeContext> = {}): NudgeContext {
  return {
    now: 1_700_000_000_000,
    minuteOfDay: 15 * 60,
    load: speakUp,
    proactiveOptIn: true,
    quietStartMin: 22 * 60,
    quietEndMin: 7 * 60,
    inProtectedBlock: false,
    nudgesSentToday: 0,
    dailyCap: 2,
    ...overrides,
  }
}

describe('decideNudge — delivery', () => {
  it('SpeakUpOptedInOutsideQuietUnprotectedUnderCap_Delivers', () => {
    expect(decideNudge(ctx())).toEqual({ deliver: true })
  })

  it('LastAllowedNudgeOfTheDay_StillDelivers', () => {
    expect(decideNudge(ctx({ nudgesSentToday: 1, dailyCap: 2 }))).toEqual({ deliver: true })
  })
})

describe('decideNudge — suppression reasons and digest', () => {
  it('CalmLoad_SuppressesWithoutDigest', () => {
    expect(decideNudge(ctx({ load: calm }))).toEqual({
      deliver: false,
      reason: 'calm',
      digest: false,
    })
  })

  it('WatchLoad_IsNotYetASpeakUp_SuppressesAsCalm', () => {
    // Watch informs the in-app surfaces; only a speak-up may cross into a notification.
    expect(decideNudge(ctx({ load: watch }))).toEqual({
      deliver: false,
      reason: 'calm',
      digest: false,
    })
  })

  it('OptedOut_SuppressesWithoutDigest', () => {
    expect(decideNudge(ctx({ proactiveOptIn: false }))).toEqual({
      deliver: false,
      reason: 'opt-out',
      digest: false,
    })
  })

  it('ProtectedBlock_SuppressesAndFoldsIntoTheDigest', () => {
    expect(decideNudge(ctx({ inProtectedBlock: true }))).toEqual({
      deliver: false,
      reason: 'protected',
      digest: true,
    })
  })

  it('QuietHours_SuppressesAndFoldsIntoTheDigest', () => {
    expect(decideNudge(ctx({ minuteOfDay: 23 * 60 }))).toEqual({
      deliver: false,
      reason: 'quiet-hours',
      digest: true,
    })
  })

  it('DailyCapReached_SuppressesWithoutDigest', () => {
    expect(decideNudge(ctx({ nudgesSentToday: 2, dailyCap: 2 }))).toEqual({
      deliver: false,
      reason: 'cap-reached',
      digest: false,
    })
  })
})

describe('decideNudge — suppressor precedence (calm > opt-out > protected > quiet-hours > cap)', () => {
  it('CalmAndOptedOut_ReportsCalm', () => {
    const d = decideNudge(ctx({ load: calm, proactiveOptIn: false }))
    expect(d).toMatchObject({ deliver: false, reason: 'calm' })
  })

  it('OptedOutInsideAProtectedBlock_ReportsOptOut', () => {
    const d = decideNudge(ctx({ proactiveOptIn: false, inProtectedBlock: true }))
    expect(d).toMatchObject({ deliver: false, reason: 'opt-out', digest: false })
  })

  it('ProtectedDuringQuietHours_ReportsProtected', () => {
    const d = decideNudge(ctx({ inProtectedBlock: true, minuteOfDay: 23 * 60 }))
    expect(d).toMatchObject({ deliver: false, reason: 'protected', digest: true })
  })

  it('QuietHoursWithTheCapReached_ReportsQuietHours', () => {
    const d = decideNudge(ctx({ minuteOfDay: 23 * 60, nudgesSentToday: 2 }))
    expect(d).toMatchObject({ deliver: false, reason: 'quiet-hours', digest: true })
  })
})

describe('inQuietWindow — half-open [start, end), wrap-aware', () => {
  it('NonWrappingWindow_ContainsItsInsideAndNotItsOutside', () => {
    expect(inQuietWindow(9 * 60, 8 * 60, 17 * 60)).toBe(true)
    expect(inQuietWindow(7 * 60, 8 * 60, 17 * 60)).toBe(false)
    expect(inQuietWindow(18 * 60, 8 * 60, 17 * 60)).toBe(false)
  })

  it('WindowBoundaries_StartIsInsideEndIsOutside', () => {
    expect(inQuietWindow(8 * 60, 8 * 60, 17 * 60)).toBe(true)
    expect(inQuietWindow(17 * 60, 8 * 60, 17 * 60)).toBe(false)
  })

  it('MidnightWrappingWindow_CoversLateEveningAndEarlyMorning', () => {
    // 22:00 → 07:00: 23:30 and 05:00 are quiet, 12:00 is not.
    expect(inQuietWindow(23 * 60 + 30, 1320, 420)).toBe(true)
    expect(inQuietWindow(5 * 60, 1320, 420)).toBe(true)
    expect(inQuietWindow(12 * 60, 1320, 420)).toBe(false)
  })

  it('WrappingWindowBoundaries_StartIsInsideEndIsOutside', () => {
    expect(inQuietWindow(1320, 1320, 420)).toBe(true)
    expect(inQuietWindow(420, 1320, 420)).toBe(false)
  })

  it('StartEqualsEnd_MeansNoQuietWindowAtAll', () => {
    expect(inQuietWindow(0, 600, 600)).toBe(false)
    expect(inQuietWindow(600, 600, 600)).toBe(false)
  })
})

describe('decideNudge — wrap-around quiet hours end to end', () => {
  it('EarlyMorningInsideAWrappedWindow_IsQuietSuppressed', () => {
    expect(decideNudge(ctx({ minuteOfDay: 6 * 60 }))).toEqual({
      deliver: false,
      reason: 'quiet-hours',
      digest: true,
    })
  })

  it('MorningJustAfterAWrappedWindowEnds_Delivers', () => {
    expect(decideNudge(ctx({ minuteOfDay: 7 * 60 }))).toEqual({ deliver: true })
  })
})
