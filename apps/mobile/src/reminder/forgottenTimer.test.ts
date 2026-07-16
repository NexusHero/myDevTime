import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FORGOTTEN_THRESHOLD_MS,
  DEFAULT_TRIM_DURATION_MS,
  forgottenTimerProposal,
} from './forgottenTimer.js'

const HOUR = 60 * 60 * 1000
const start = Date.parse('2026-07-15T17:00:00.000Z')

/**
 * The forgotten-timer rule fires only from the timer's own elapsed runtime (no
 * surveillance), past a plausible threshold, and suggests a trimmed end. These pin the
 * threshold, the dismissal/no-timer short-circuits, and the trim clamp.
 */
describe('forgottenTimerProposal', () => {
  it('NoRunningTimer_IsNull', () => {
    expect(
      forgottenTimerProposal({ startedAtMs: null, nowMs: start + 20 * HOUR, dismissed: false }),
    ).toBeNull()
  })

  it('WithinThreshold_IsNull', () => {
    // 9 h in — under the 10 h default, so no nag.
    expect(
      forgottenTimerProposal({ startedAtMs: start, nowMs: start + 9 * HOUR, dismissed: false }),
    ).toBeNull()
  })

  it('PastThreshold_ProposesTrimToTheSuggestedDayLength', () => {
    // Running 16 h (overnight) → propose trimming to the 8 h default.
    const p = forgottenTimerProposal({
      startedAtMs: start,
      nowMs: start + 16 * HOUR,
      dismissed: false,
    })
    expect(p).not.toBeNull()
    expect(p?.elapsedMs).toBe(16 * HOUR)
    expect(p?.suggestedEndMs).toBe(start + DEFAULT_TRIM_DURATION_MS)
  })

  it('FiresExactlyAtTheThreshold', () => {
    const p = forgottenTimerProposal({
      startedAtMs: start,
      nowMs: start + DEFAULT_FORGOTTEN_THRESHOLD_MS,
      dismissed: false,
    })
    expect(p).not.toBeNull()
  })

  it('Dismissed_IsNull', () => {
    expect(
      forgottenTimerProposal({ startedAtMs: start, nowMs: start + 20 * HOUR, dismissed: true }),
    ).toBeNull()
  })

  it('SuggestedEndNeverExceedsNow', () => {
    // A custom short trim longer than the elapsed → clamp to now, not the future.
    const p = forgottenTimerProposal({
      startedAtMs: start,
      nowMs: start + 11 * HOUR,
      dismissed: false,
      trimDurationMs: 20 * HOUR,
    })
    expect(p?.suggestedEndMs).toBe(start + 11 * HOUR)
  })
})
