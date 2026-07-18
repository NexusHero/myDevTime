import { formatDuration } from '@mydevtime/design'

/**
 * Idle-return detection (REQ-033, #42) — the deterministic rule behind the "you were away
 * while the timer ran" banner. Pure and clock-injected: it decides *whether* the user has
 * just come back from a long-enough absence purely from the last observed activity instant
 * and the running-timer flag — no app/window surveillance, no AI. It only proposes; the
 * banner's Keep/Stop actions are the user's confirmation and nothing auto-modifies the
 * entry (ADR-0005).
 */

/** With a running timer, this long without activity counts as "away" (10 minutes). */
export const DEFAULT_IDLE_RETURN_THRESHOLD_MS = 10 * 60_000

export interface IdleReturnInput {
  /** The last observed user-activity instant (ms epoch). */
  readonly lastActiveAt: number
  readonly now: number
  /** A project timer is running — idle time only matters while time is being tracked. */
  readonly timerRunning: boolean
  /** Absence at/after which the banner fires (default 10 minutes). */
  readonly thresholdMs?: number
}

/**
 * The idle stretch to surface, or null when there is nothing to report — no running
 * timer, activity within the threshold, or a clock that skewed backwards (a negative
 * gap is noise, never an absence).
 */
export function idleReturn(input: IdleReturnInput): { idleMs: number } | null {
  if (!input.timerRunning) return null
  const threshold = input.thresholdMs ?? DEFAULT_IDLE_RETURN_THRESHOLD_MS
  const idleMs = input.now - input.lastActiveAt
  if (!Number.isFinite(idleMs) || idleMs < 0) return null
  if (idleMs < threshold) return null
  return { idleMs }
}

/** An idle stretch as the app-wide duration label (`H:MM h`, via the design formatter). */
export function formatIdle(ms: number): string {
  return `${formatDuration(ms)} h`
}
