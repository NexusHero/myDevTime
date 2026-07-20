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

/** Test seam: forget every recorded voice. */
export function resetNudgeBudget(): void {
  sentByDay.clear()
}
