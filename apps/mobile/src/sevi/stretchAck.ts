/**
 * Day-scoped stretch acknowledgment (ADR-0072 D1, REQ-072): when the user consciously accepts
 * a day repair whose price over their own capacity line was stated up front, the overrun was
 * *chosen*, not drifted into — so Sevi's own-baseline tier stays quiet about it for the rest
 * of THAT day only. Persisted like the planner's other lightweight day-state (the
 * yesterday-healing "seen" marker): a per-day `localStorage` key, so the acknowledgment
 * survives a reload but expires with the calendar day; an in-memory mirror keeps the contract
 * on native/private-mode where `localStorage` is unavailable. Never a global mute — the domain
 * `decideNudge` still lets every hard-cap speak-up through (the policy, not this store,
 * enforces that).
 */

const KEY_PREFIX = 'mydevtime.sevi.stretchAck.'

/** The device-local calendar day a timestamp falls on (same convention as the nudge budget). */
function dayKeyOf(now: number): string {
  const d = new Date(now)
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1)}-${String(d.getDate())}`
}

// In-memory mirror: authoritative when localStorage is missing, and a same-session backstop
// when a private-mode write throws after the fact.
const acknowledged = new Set<string>()

/** Record that today's accepted repair consciously stretched past the capacity line. */
export function recordStretchAck(now: number): void {
  const key = dayKeyOf(now)
  acknowledged.add(key)
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY_PREFIX + key, '1')
  } catch {
    /* best-effort persistence; the in-memory mirror still covers this session */
  }
}

/** Whether a stretch was consciously acknowledged for the day `now` falls on. */
export function stretchAckActive(now: number): boolean {
  const key = dayKeyOf(now)
  if (acknowledged.has(key)) return true
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY_PREFIX + key) === '1'
  } catch {
    return false
  }
}

/** Test seam: forget every acknowledgment (memory + storage). */
export function resetStretchAck(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      for (const key of acknowledged) localStorage.removeItem(KEY_PREFIX + key)
    }
  } catch {
    /* ignore */
  }
  acknowledged.clear()
}
