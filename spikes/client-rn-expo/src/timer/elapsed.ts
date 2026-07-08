/**
 * Spike #1 · Q1 (timer reliability) — the load-bearing idea, extracted as pure,
 * platform-independent logic so it can be tested without a device.
 *
 * The timer NEVER counts ticks. Its entire state is two numbers:
 *   - `startedAt`      absolute epoch-ms of the currently running segment (or null)
 *   - `accumulatedMs`  sum of all previously closed segments
 *
 * Elapsed time is always *derived* from the wall clock: `accumulated + (now -
 * startedAt)`. That is what makes a running timer survive backgrounding, an app
 * kill, and a full device reboot: nothing is lost because nothing was being
 * counted — on cold start we rehydrate the two numbers and re-derive against
 * `Date.now()`. The UI's per-second tick is cosmetic; correctness never depends
 * on it firing.
 *
 * This mirrors the deterministic tracking core in `packages/domain` (instants are
 * epoch-ms), so an entry produced here drops straight into the real domain.
 */

export interface TimerState {
  /** Epoch-ms when the current running segment began, or null when paused/stopped. */
  readonly startedAt: number | null
  /** Sum of all previously closed segments, in ms. */
  readonly accumulatedMs: number
}

export const STOPPED: TimerState = { startedAt: null, accumulatedMs: 0 }

export function isRunning(state: TimerState): boolean {
  return state.startedAt !== null
}

/** Start (or resume) the timer at `now`. No-op if already running. */
export function start(state: TimerState, now: number): TimerState {
  if (state.startedAt !== null) return state
  return { startedAt: now, accumulatedMs: state.accumulatedMs }
}

/**
 * Pause: fold the open segment into the accumulated total. No-op if not running.
 * A backwards clock (NTP correction, manual set) can never shrink the total — a
 * negative segment is clamped to zero.
 */
export function pause(state: TimerState, now: number): TimerState {
  if (state.startedAt === null) return state
  const segment = Math.max(0, now - state.startedAt)
  return { startedAt: null, accumulatedMs: state.accumulatedMs + segment }
}

/** Total elapsed ms as of `now` — the single source of truth for what's displayed. */
export function elapsedMs(state: TimerState, now: number): number {
  const open = state.startedAt === null ? 0 : Math.max(0, now - state.startedAt)
  return state.accumulatedMs + open
}

/**
 * Stop and produce the closed interval to persist as a time entry, plus the reset
 * state. Returns `null` for `entry` when nothing was tracked. The entry carries
 * `startedAt`/`endedAt` as epoch-ms so it maps 1:1 onto the tracking domain.
 */
export function stop(
  state: TimerState,
  now: number,
): { readonly state: TimerState; readonly entry: { startedAt: number; endedAt: number } | null } {
  const total = elapsedMs(state, now)
  if (total <= 0) return { state: STOPPED, entry: null }
  return { state: STOPPED, entry: { startedAt: now - total, endedAt: now } }
}
