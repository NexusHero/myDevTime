/**
 * Sevi's shared daily nudge budget (ADR-0071 P2): the ≤1–2-voices-per-day cap is per *person
 * per day*, not per surface — the real-time watch and the life-care voices draw from the SAME
 * counter, so two surfaces can never double Sevi's daily allowance. Session-local by design
 * (a restart resets it — the cap is a calm-down guarantee, not an audit log), keyed by the
 * device-local calendar day.
 */
export const SEVI_DAILY_CAP = 2

const sentByDay = new Map<string, number>()

/** The device-local calendar day a timestamp falls on. */
function dayKeyOf(now: number): string {
  const d = new Date(now)
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1)}-${String(d.getDate())}`
}

/** How many Sevi voices have already been delivered today (all surfaces combined). */
export function nudgesSentToday(now: number): number {
  return sentByDay.get(dayKeyOf(now)) ?? 0
}

/** Record one delivered voice against today's shared budget. */
export function recordNudge(now: number): void {
  const key = dayKeyOf(now)
  sentByDay.set(key, (sentByDay.get(key) ?? 0) + 1)
}

/**
 * Atomically claim one voice slot for today: check and increment in ONE synchronous step,
 * `false` (and no increment) at/over `cap`. This is the delivery gate the hooks must use —
 * a render-time `nudgesSentToday` check plus a later `recordNudge` is a check-then-act race:
 * with two surfaces mounted, one commit can pass both checks at cap−1 and deliver past the
 * cap. JS is single-threaded, so synchronous check+increment IS the atomicity needed here.
 */
export function tryClaimNudge(now: number, cap: number): boolean {
  const key = dayKeyOf(now)
  const sent = sentByDay.get(key) ?? 0
  if (sent >= cap) return false
  sentByDay.set(key, sent + 1)
  return true
}

/** Test seam: forget every recorded voice. */
export function resetNudgeBudget(): void {
  sentByDay.clear()
}
