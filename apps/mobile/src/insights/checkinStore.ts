/**
 * Local-only persistence for the weekly Balance check-in (design v10 §Balance). The
 * check-in is an OLBI short-form self-report (exhaustion + detachment) — sensitive
 * wellbeing data — so by contract it **never leaves the device**: it is stored only
 * here, never sent to the server, exactly as the card promises ("stays on your
 * device"). Same cross-platform seam as `onboardingStore`/`timerStore`: `localStorage`
 * on web (the current render target), an in-memory fallback on native until a durable
 * native store is wired. One key, one record — the most recent check-in.
 */
const KEY = 'mydevtime.checkin'

/** One week's self-report: two 1–5 scales, tagged with the week it belongs to. */
export interface WeeklyCheckin {
  /** The Monday (`YYYY-MM-DD`) of the week this check-in covers — the "one per week" key. */
  readonly week: string
  /** OLBI exhaustion item, 1 (strongly disagree) … 5 (strongly agree). */
  readonly exhaustion: number
  /** OLBI detachment item, 1 (strongly disagree) … 5 (strongly agree). */
  readonly detachment: number
}

/** Best-effort `localStorage`, or null when it is unavailable (native / SSR). */
function web(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

let memory: string | null = null

/** A 1–5 scale value from unknown input, or null when out of range / missing. */
function scale(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
    ? value
    : null
}

/** Load the most recent check-in, or null when nothing valid is stored. */
export function loadCheckin(): WeeklyCheckin | null {
  const store = web()
  const raw = store ? store.getItem(KEY) : memory
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const rec = parsed as Record<string, unknown>
    const exhaustion = scale(rec.exhaustion)
    const detachment = scale(rec.detachment)
    if (typeof rec.week !== 'string' || exhaustion === null || detachment === null) return null
    return { week: rec.week, exhaustion, detachment }
  } catch {
    return null
  }
}

/** Persist the latest check-in (overwrites the previous one — one record is kept). */
export function saveCheckin(checkin: WeeklyCheckin): void {
  const raw = JSON.stringify(checkin)
  const store = web()
  if (store) store.setItem(KEY, raw)
  else memory = raw
}
