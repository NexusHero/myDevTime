/**
 * Sevi — intraday live-load core (ADR-0071 P1, REQ-067). Pure and deterministic (ADR-0005):
 * *whether* Sevi speaks is 100 % this function; the LLM only phrases afterwards. It turns the
 * already-deterministic worktime feed of the running day (worked so far · continuous focus since
 * the last break · back-to-back-meeting streak · overtime accrued) into an escalation level
 * (`calm | watch | speak-up`) plus typed, human-meaningful reasons.
 *
 * Two kinds of boundaries, per the ADR-0066 H3 ethic:
 * - **Universal hard caps** — legally grounded lines that are red for everyone, regardless of the
 *   person's own baseline: ≥ 6 h continuous work with no break (ArbZG §4, a *hint* — mirrors
 *   `attendance/break-rule.ts`), ≥ 9.5 h worked (approaching the ArbZG §3 10 h maximum), and a
 *   run of heavy days (`CONSECUTIVE_HEAVY_MINIMUM`, reused from the baseline core). A cap sets
 *   `hardCapHit` and forces `speak-up`.
 * - **The person's own band** — everything else compares a composite live score against the top
 *   of *their* normal band (`computeBaseline().normalHigh`). A short history yields `+∞` there,
 *   so nothing ever reads as above-baseline from thin data — honest silence, never a verdict.
 *
 * No clock, no I/O: `now` and every duration are passed in by the caller (purity).
 */

import { HOUR_MS, MINUTE_MS } from '../tracking/time.js'
import { CONSECUTIVE_HEAVY_MINIMUM } from './baseline.js'

/** The intraday escalation level, calmest→loudest. Distinct from the day-scoped `DayLoadLevel`. */
export type LoadLevel = 'calm' | 'watch' | 'speak-up'

/** One typed, human-meaningful reason the level is what it is. The LLM narrates, never invents. */
export type LiveLoadReason =
  | 'long-day'
  | 'no-break'
  | 'meeting-marathon'
  | 'overtime-today'
  | 'above-baseline'
  | 'consecutive-heavy'

/** The running day's real, already-computed signals — this core fetches nothing. */
export interface LiveLoadInput {
  /** The evaluation instant (epoch ms), passed in — never read from a clock (purity). */
  readonly now: number
  /** Milliseconds worked so far today. */
  readonly workedMsToday: number
  /** Continuous work since the last break, in milliseconds. */
  readonly focusMsSinceBreak: number
  /** How many meetings so far ran back-to-back with the previous one. */
  readonly backToBackMeetings: number
  /** Overtime accrued today beyond target, in milliseconds (0 when none). */
  readonly overtimeMsToday: number
  /**
   * Top of the person's own normal band (`computeBaseline().normalHigh`). `+Infinity` on a
   * short history, so `above-baseline` can never fire before there is enough of their own data.
   */
  readonly baselineNormalHigh: number
  /** Length of the current run of heavy days ending yesterday (from the baseline history). */
  readonly consecutiveHeavyDays: number
}

export interface LiveLoad {
  readonly level: LoadLevel
  /** Every firing reason, in a stable declaration order (never prose). */
  readonly reasons: readonly LiveLoadReason[]
  /** A universal cap was crossed (baseline-independent) — always forces `speak-up`. */
  readonly hardCapHit: boolean
}

// ─── Documented thresholds ────────────────────────────────────────────────────────────────
// Hard caps are deliberately tiny and legally grounded (ADR-0071); the watch thresholds sit
// one nudge *before* each cap so Sevi can tap the shoulder before the line, not at it.

/** Hard cap: ≥ 6 h continuous work with no break (ArbZG §4 hint, cf. `attendance/break-rule.ts`). */
export const NO_BREAK_CAP_MS = 6 * HOUR_MS
/** Hard cap: ≥ 9.5 h worked today — approaching the ArbZG §3 10 h daily maximum. */
export const LONG_DAY_CAP_MS = 9.5 * HOUR_MS
/** Watch: a focus run at 5 h is approaching the 6 h no-break cap. */
export const WATCH_FOCUS_MS = 5 * HOUR_MS
/** Watch: 8.5 h worked is approaching the 9.5 h long-day cap. */
export const WATCH_WORKED_MS = 8.5 * HOUR_MS
/** Watch: this many back-to-back meetings read as a meeting marathon. */
export const WATCH_BACK_TO_BACK = 3

/** A standard 8 h day — the same origin `dayReview`'s long-day term accrues from. */
const STANDARD_DAY_MS = 8 * HOUR_MS
/** The planner's break rhythm: one 15-min break owed per 90 contiguous focus minutes. */
const BREAK_EVERY_MS = 90 * MINUTE_MS

/**
 * The composite live score, on the **same scale** as `dayReview`'s `loadScore` so the person's
 * own band (computed over persisted day scores) is directly comparable. Mirror of the documented
 * day weights, restricted to what is knowable mid-day (each term is `max(0, …)`):
 *   • long day:      hours worked past a standard 8 h day        → 1.0 / hour
 *   • overtime:      overtime accrued today                      → 1.0 / 30 min
 *   • back-to-back:  back-to-back meetings so far                → 1.0 / meeting
 *   • break debt:    breaks owed by the current focus run — one 15-min break per full 90 focus
 *                    minutes (the planner's 90/15 rhythm)        → 1.0 / owed break
 * Rounded to one decimal, exactly like the day score.
 */
export function liveLoadScore(input: LiveLoadInput): number {
  const longDay = Math.max(0, input.workedMsToday - STANDARD_DAY_MS) / HOUR_MS
  const overtime = Math.max(0, input.overtimeMsToday) / (30 * MINUTE_MS)
  const backToBack = Math.max(0, input.backToBackMeetings) * 1
  const breakDebt = Math.floor(Math.max(0, input.focusMsSinceBreak) / BREAK_EVERY_MS) * 1
  return Math.round((longDay + overtime + backToBack + breakDebt) * 10) / 10
}

/**
 * Evaluate the running day into a live-load level plus reasons. Hard caps fire regardless of the
 * baseline (`hardCapHit`, `speak-up`); the watch band catches "approaching a cap" and a composite
 * score above the person's *own* `normalHigh` (`above-baseline`, plus `overtime-today` when
 * overtime contributed). Absent/zero inputs are `calm` with no reasons — an empty day is never
 * an alarm.
 */
export function evaluateLiveLoad(input: LiveLoadInput): LiveLoad {
  const capNoBreak = input.focusMsSinceBreak >= NO_BREAK_CAP_MS
  const capLongDay = input.workedMsToday >= LONG_DAY_CAP_MS
  const capHeavyRun = input.consecutiveHeavyDays >= CONSECUTIVE_HEAVY_MINIMUM
  const hardCapHit = capNoBreak || capLongDay || capHeavyRun

  const aboveBaseline = liveLoadScore(input) > input.baselineNormalHigh

  // Stable declaration order; a watch reason and its cap share one entry (the cap implies it).
  const reasons: LiveLoadReason[] = []
  if (capLongDay || input.workedMsToday >= WATCH_WORKED_MS) reasons.push('long-day')
  if (capNoBreak || input.focusMsSinceBreak >= WATCH_FOCUS_MS) reasons.push('no-break')
  if (input.backToBackMeetings >= WATCH_BACK_TO_BACK) reasons.push('meeting-marathon')
  if (aboveBaseline && input.overtimeMsToday > 0) reasons.push('overtime-today')
  if (aboveBaseline) reasons.push('above-baseline')
  if (capHeavyRun) reasons.push('consecutive-heavy')

  const level: LoadLevel = hardCapHit ? 'speak-up' : reasons.length > 0 ? 'watch' : 'calm'
  return { level, reasons, hardCapHit }
}
