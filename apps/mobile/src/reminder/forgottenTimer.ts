/**
 * Forgotten-tracking detection (REQ-033, ADR-0012) — the deterministic rule behind the
 * "did you forget to stop this timer?" proposal. Pure and clock-injected: it decides
 * *whether* a running timer has been going implausibly long from the timer's OWN runtime
 * — never app/window surveillance (ADR-0012's non-negotiable) — and, if so, what a
 * plausible trimmed end would be. It only proposes; nothing auto-corrects. The component
 * renders what this returns and every action is the user's confirmation.
 */

/** A running timer nags as "forgotten" once it has been going at least this long (10 h). */
export const DEFAULT_FORGOTTEN_THRESHOLD_MS = 10 * 60 * 60 * 1000
/** The plausible day-length the trim proposal offers to cut a forgotten timer down to (8 h). */
export const DEFAULT_TRIM_DURATION_MS = 8 * 60 * 60 * 1000

export interface ForgottenTimerInput {
  /** When the running segment started (ms epoch), or null when no timer is running. */
  readonly startedAtMs: number | null
  readonly nowMs: number
  /** The user dismissed the proposal for this run. */
  readonly dismissed: boolean
  /** Elapsed at/after which the timer is treated as forgotten (default 10 h). */
  readonly thresholdMs?: number
  /** The trimmed duration the proposal suggests (default 8 h). */
  readonly trimDurationMs?: number
}

export interface ForgottenTimerProposal {
  /** How long the timer has actually been running (ms). */
  readonly elapsedMs: number
  /**
   * A plausible trimmed end (ms epoch): the start plus the suggested day-length, never
   * later than now (a shorter-than-suggested overrun would just stop at now instead).
   */
  readonly suggestedEndMs: number
}

/**
 * The forgotten-timer proposal, or null when there is nothing to propose — no running
 * timer, still within the plausible threshold, or already dismissed. Evidence is purely
 * the timer's elapsed runtime, so this works on every platform and reveals nothing about
 * what the user was doing.
 */
export function forgottenTimerProposal(input: ForgottenTimerInput): ForgottenTimerProposal | null {
  if (input.startedAtMs === null || input.dismissed) return null
  const threshold = input.thresholdMs ?? DEFAULT_FORGOTTEN_THRESHOLD_MS
  const elapsedMs = input.nowMs - input.startedAtMs
  if (elapsedMs < threshold) return null
  const trim = input.trimDurationMs ?? DEFAULT_TRIM_DURATION_MS
  const suggestedEndMs = Math.min(input.nowMs, input.startedAtMs + trim)
  return { elapsedMs, suggestedEndMs }
}
