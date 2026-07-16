/**
 * Smart Reminder (design v10 §D12) — the deterministic rule behind the "you're
 * clocked in but not tracking" nudge. Pure and clock-injected: it decides *whether*
 * to nudge from real state (an open work-time shift, no active timer, time elapsed
 * since clock-in, and whether the user dismissed it). No AI, no fabrication — the
 * component only renders what this returns. "Deterministisch, kein Violett."
 */

/** A work-time shift is open, but no timer has been running for this long → nudge. */
export const DEFAULT_REMINDER_THRESHOLD_MS = 600_000 // 10 minutes

export interface ReminderInput {
  /** A work-time shift is open (the user is clocked in). */
  readonly punchedIn: boolean
  /** A project timer is running or paused (time is being tracked). */
  readonly timerActive: boolean
  /** When the open shift started (ms epoch), or null when not clocked in. */
  readonly clockedInSinceMs: number | null
  readonly nowMs: number
  /** The user dismissed the nudge for this shift. */
  readonly dismissed: boolean
  readonly thresholdMs?: number
}

/**
 * True when the user has been clocked in for at least the threshold without any
 * timer running (or paused) and has not dismissed the nudge. Any of: not clocked in,
 * a timer already active, or dismissed → false.
 */
export function shouldRemindToTrack(input: ReminderInput): boolean {
  if (!input.punchedIn || input.timerActive || input.dismissed) return false
  if (input.clockedInSinceMs === null) return false
  const threshold = input.thresholdMs ?? DEFAULT_REMINDER_THRESHOLD_MS
  return input.nowMs - input.clockedInSinceMs >= threshold
}
