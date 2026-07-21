/**
 * Sevi — nudge delivery policy (ADR-0071 P2, REQ-069). Pure and deterministic (ADR-0005): the
 * live-load core decides *whether there is something to say*; this policy decides *whether now
 * is the moment to say it out loud*. A nudge is delivered only when every gate agrees — the load
 * is a `speak-up`, the user has opted in to proactivity, it is outside their quiet hours (a
 * window that may wrap midnight), no 🛡 protected block is active (REQ-057), and the daily cap
 * (at most 1–2 voices per day) is not spent. Sevi is proactive the way a good colleague is:
 * a tap on the shoulder when it counts, silence otherwise.
 *
 * A suppressed decision names its reason with a fixed precedence, and `digest` marks the two
 * cases (quiet hours, protection) where a real speak-up was *held* and may be folded into ONE
 * later digest — the REQ-057 "hold nudges, one digest after" rule — never a queue of pings.
 * No clock, no I/O: `now` and the caller-derived local `minuteOfDay` are passed in (purity).
 */

import type { LiveLoad } from './liveLoad.js'

export interface NudgeContext {
  /** The evaluation instant (epoch ms), passed in — never read from a clock (purity). */
  readonly now: number
  /** Local minute of day, 0..1439, derived by the caller (the core carries no timezone). */
  readonly minuteOfDay: number
  readonly load: LiveLoad
  /** The user's explicit opt-in to proactive Sevi (off by default — ADR-0071 P2). */
  readonly proactiveOptIn: boolean
  /** Quiet-hours window start (minute of day). The window may wrap midnight (e.g. 1320→420). */
  readonly quietStartMin: number
  /** Quiet-hours window end (minute of day, exclusive). `start === end` means no quiet window. */
  readonly quietEndMin: number
  /** A 🛡 protected block is active right now (REQ-057). */
  readonly inProtectedBlock: boolean
  /** Proactive nudges already delivered today. */
  readonly nudgesSentToday: number
  /** The daily voice budget (1..2 — ADR-0071 P2 rate limit). */
  readonly dailyCap: number
  /**
   * Day-scoped acknowledgment of a consciously accepted stretch (ADR-0072 D1): the user
   * tapped a repair whose price over their own capacity line was stated up front, so the
   * own-baseline tier stays quiet about that overrun for the rest of the day. Never a
   * global mute — a hard-cap speak-up still gets through.
   */
  readonly stretchAckActive?: boolean
}

export type NudgeDecision =
  | { readonly deliver: true }
  | {
      readonly deliver: false
      readonly reason:
        'calm' | 'stretch-acknowledged' | 'opt-out' | 'quiet-hours' | 'protected' | 'cap-reached'
      /** True only when a real speak-up was held (quiet hours / protected) — fold into ONE digest. */
      readonly digest: boolean
    }

/**
 * Whether `minuteOfDay` falls inside the half-open quiet window `[start, end)`. A window whose
 * end precedes its start wraps midnight (22:00→07:00 covers late evening *and* early morning);
 * `start === end` is an empty window, never "all day" — turning quiet hours off must be possible.
 */
export function inQuietWindow(minuteOfDay: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return false
  if (startMin < endMin) return minuteOfDay >= startMin && minuteOfDay < endMin
  return minuteOfDay >= startMin || minuteOfDay < endMin
}

/**
 * Decide whether to deliver a proactive nudge right now. Delivery requires every gate; a
 * suppression reports the *first* applicable reason in the fixed precedence
 * `calm > stretch-acknowledged > opt-out > protected > quiet-hours > cap-reached`, so callers
 * see the most fundamental suppressor (there is nothing to digest when the load was calm, the
 * stretch was chosen, or the user opted out).
 */
export function decideNudge(ctx: NudgeContext): NudgeDecision {
  if (ctx.load.level !== 'speak-up') return { deliver: false, reason: 'calm', digest: false }
  // An acknowledged stretch was chosen, not drifted into (ADR-0072 D1) — but the ArbZG hard
  // caps stay inviolable: a hard-cap speak-up is NEVER silenced by the acknowledgment.
  if (ctx.stretchAckActive === true && !ctx.load.hardCapHit) {
    return { deliver: false, reason: 'stretch-acknowledged', digest: false }
  }
  if (!ctx.proactiveOptIn) return { deliver: false, reason: 'opt-out', digest: false }
  if (ctx.inProtectedBlock) return { deliver: false, reason: 'protected', digest: true }
  if (inQuietWindow(ctx.minuteOfDay, ctx.quietStartMin, ctx.quietEndMin)) {
    return { deliver: false, reason: 'quiet-hours', digest: true }
  }
  if (ctx.nudgesSentToday >= ctx.dailyCap) {
    return { deliver: false, reason: 'cap-reached', digest: false }
  }
  return { deliver: true }
}
