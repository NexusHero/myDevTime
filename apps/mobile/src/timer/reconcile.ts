import type { StartTimerInput, TimeEntry } from '../api/timer.js'

/**
 * The client-only slice of timer state that must survive an app restart alongside
 * the server's running entry (REQ-004): the time banked from already-paused segments
 * this session, and the paused context to resume from. The server models whether a
 * *segment* is running, but not the session's banked total or its paused flag — so
 * that lives here and is persisted locally (`timerStore`).
 */
export interface PersistedTimerSession {
  readonly accumulatedMs: number
  readonly pausedInput: StartTimerInput | null
}

/** The reconciled timer state to hydrate the hook with after a restart. */
export interface RestoredTimer {
  readonly running: TimeEntry | null
  readonly accumulatedMs: number
  readonly pausedInput: StartTimerInput | null
}

/**
 * Reconcile the server's running entry with the locally-persisted session so the
 * timer restores exactly after an app restart. The **server is authoritative** for
 * whether a segment is running; the local state carries the banked total and paused
 * context. A running server entry always wins over a stale persisted "paused" flag;
 * banked time without either a running segment or a paused context is meaningless and
 * collapses to idle.
 */
export function reconcileTimer(
  serverRunning: TimeEntry | null,
  persisted: PersistedTimerSession | null,
): RestoredTimer {
  const banked = persisted && persisted.accumulatedMs > 0 ? persisted.accumulatedMs : 0

  if (serverRunning !== null) {
    // A segment is running server-side: continue the session, keep the banked time,
    // and drop any paused flag (running wins over an inconsistent persisted pause).
    return { running: serverRunning, accumulatedMs: banked, pausedInput: null }
  }
  if (persisted && persisted.pausedInput !== null) {
    // No running segment, but a paused context persisted → restore the paused session.
    return { running: null, accumulatedMs: banked, pausedInput: persisted.pausedInput }
  }
  // Nothing active anywhere → idle.
  return { running: null, accumulatedMs: 0, pausedInput: null }
}
