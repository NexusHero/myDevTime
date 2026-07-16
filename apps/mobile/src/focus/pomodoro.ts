/**
 * Focus mode — the Pomodoro phase state machine (REQ-032, ADR-0012). Pure and
 * clock-injected (ADR-0005): it owns only the *cadence* (focus → break → … → long
 * break), never the tracked time — each focus interval runs as an ordinary timer
 * segment, so the minutes reach the timesheet through the normal timer, not from here.
 * Deterministic transitions + remaining-time math, unit-tested directly.
 */

export type PomodoroPhase = 'focus' | 'break' | 'longBreak'

export interface PomodoroConfig {
  readonly focusMs: number
  readonly breakMs: number
  readonly longBreakMs: number
  /** A long break replaces the short break after this many completed focus intervals. */
  readonly cyclesBeforeLongBreak: number
}

/** The classic 25/5/15 × 4 cadence. */
export const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  focusMs: 25 * 60_000,
  breakMs: 5 * 60_000,
  longBreakMs: 15 * 60_000,
  cyclesBeforeLongBreak: 4,
}

/** A break phase pauses tracking; focus runs a timer segment. */
export function isBreakPhase(phase: PomodoroPhase): boolean {
  return phase === 'break' || phase === 'longBreak'
}

/** The configured length of a phase, in ms. */
export function phaseDurationMs(phase: PomodoroPhase, config: PomodoroConfig): number {
  if (phase === 'focus') return config.focusMs
  if (phase === 'longBreak') return config.longBreakMs
  return config.breakMs
}

export interface PomodoroProgress {
  /** The phase to move into. */
  readonly phase: PomodoroPhase
  /** Completed focus intervals so far (increments when a focus phase finishes). */
  readonly completedFocus: number
}

/**
 * The phase that follows the one just finished. A finished **focus** interval bumps the
 * completed count and yields a break — a long break every `cyclesBeforeLongBreak`th time,
 * a short break otherwise. A finished **break** yields the next focus, count unchanged.
 * Pure — the caller supplies the current phase and how many focus intervals are done.
 */
export function advancePhase(
  current: PomodoroPhase,
  completedFocus: number,
  config: PomodoroConfig,
): PomodoroProgress {
  if (current === 'focus') {
    const done = completedFocus + 1
    const long = config.cyclesBeforeLongBreak > 0 && done % config.cyclesBeforeLongBreak === 0
    return { phase: long ? 'longBreak' : 'break', completedFocus: done }
  }
  return { phase: 'focus', completedFocus }
}

/** Milliseconds left in the current phase (clamped at 0). */
export function phaseRemainingMs(phaseEndsAtMs: number, nowMs: number): number {
  const left = phaseEndsAtMs - nowMs
  return left > 0 ? left : 0
}
