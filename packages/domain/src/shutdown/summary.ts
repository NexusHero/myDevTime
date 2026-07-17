/**
 * Feierabend / shutdown ritual (REQ-063, design v17 §K5) — the deterministic day-close
 * summary behind the Today "close the day" flow (the Sunsama shutdown benchmark). It gathers
 * what the day accounted for from **real** state: booked time, the auto-tracker's reality, how
 * much reality is still unbooked, the count of open timesheet drafts (KI6) awaiting review, and
 * tomorrow's first planned block. Pure (ADR-0005) — no clock, no I/O; the `git commit` CTA and
 * the warm glow are the client's.
 */

export interface ShutdownInput {
  /** Today's booked/tracked time, ms. */
  readonly bookedMs: number
  /** The auto-tracker's observed real-work time today, ms. */
  readonly trackedMs: number
  /** KI6 timesheet drafts still awaiting the user's review. */
  readonly openDraftCount: number
  /** Label of tomorrow's first planned block, or `null` when nothing is planned. */
  readonly tomorrowFirst: string | null
}

export interface ShutdownSummary {
  readonly bookedMs: number
  readonly trackedMs: number
  /** Reality still not booked: `max(0, tracked − booked)`. */
  readonly unbookedMs: number
  readonly openDraftCount: number
  readonly tomorrowFirst: string | null
  /** The day is fully accounted for — no open drafts and no unbooked reality. */
  readonly clean: boolean
}

/** Build the shutdown summary from the day's real state. */
export function shutdownSummary(input: ShutdownInput): ShutdownSummary {
  const bookedMs = Math.max(0, input.bookedMs)
  const trackedMs = Math.max(0, input.trackedMs)
  const openDraftCount = Math.max(0, Math.trunc(input.openDraftCount))
  const unbookedMs = Math.max(0, trackedMs - bookedMs)
  return {
    bookedMs,
    trackedMs,
    unbookedMs,
    openDraftCount,
    tomorrowFirst: input.tomorrowFirst,
    clean: openDraftCount === 0 && unbookedMs === 0,
  }
}
