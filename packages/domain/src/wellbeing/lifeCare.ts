/**
 * Sevi — life-care suggestion core (ADR-0071 P5, REQ-071). Pure and deterministic (ADR-0005):
 * *whether* a life-care voice exists is 100 % this function; the client only phrases and asks
 * for ONE explicit confirmation. Three calm suggestions, never a diagnosis:
 *
 * - **`life-encroachment`** — work has been planned over a life block or a 🛡 protected window.
 *   Concrete and already happening, so it is always ordered first.
 * - **`no-free-evening`** — over a wide-enough window, not a single evening stayed free of work.
 *   Below `MIN_EVENING_WINDOW_DAYS` the core refuses to judge: 0 free evenings across 2 days is
 *   a weekend, not a pattern — honest silence from thin data, mirroring the baseline core.
 * - **`rest-day`** — the run of heavy days (from `computeBaseline`'s consecutive-heavy flag)
 *   has reached the threshold; a calmer day is proposed, never booked.
 *
 * No clock, no I/O: every count is passed in by the caller (purity). Delivery gating (opt-in,
 * quiet hours, 🛡, the shared daily cap) is `decideNudge`'s job, not this core's.
 */

/** The closed set of life-care voices, ordered most-urgent-first in the output. */
export type LifeCareSuggestionKind = 'no-free-evening' | 'life-encroachment' | 'rest-day'

export interface LifeCareSuggestion {
  readonly kind: LifeCareSuggestionKind
  /** For `life-encroachment`: the encroached *life/protected* block — the window a confirm protects. */
  readonly blockId?: string
}

/** The week's already-derived facts — this core fetches and infers nothing. */
export interface LifeCareInput {
  /** Evenings without work in the observed window (see `freeEveningsIn`). */
  readonly eveningsFreeInWindow: number
  /** How many days the evening observation actually covers. */
  readonly windowDays: number
  /** The encroached life/protected block's id when work overlaps one, else null. */
  readonly encroachingBlockId: string | null
  /** Current run of heavy days (from `computeBaseline`'s consecutive-heavy pattern flag). */
  readonly consecutiveHeavyDays: number
}

// ─── Documented thresholds ────────────────────────────────────────────────────────────────

/**
 * `no-free-evening` needs at least this many observed days: a full working week. Below it,
 * zero free evenings is indistinguishable from a short window — the core stays silent.
 */
export const MIN_EVENING_WINDOW_DAYS = 5
/** Default heavy-day run length at which `rest-day` fires (mirrors `CONSECUTIVE_HEAVY_MINIMUM`). */
export const REST_DAY_THRESHOLD_DEFAULT = 3
/** The evening window Sevi cares about: 18:00 … */
export const EVENING_START_MIN = 18 * 60
/** … to 22:00 (exclusive), matching the Planner's evening zone. */
export const EVENING_END_MIN = 22 * 60

/** Block kinds that do NOT consume an evening: one's own life and breaks are what evenings are *for*. */
const NON_WORK_KINDS: readonly string[] = ['life', 'break']

/** One placed block, day-indexed within the observed window (any kind vocabulary — see `NON_WORK_KINDS`). */
export interface EveningBlock {
  /** 0-based day within the observed window; off-window indices are ignored. */
  readonly dayIndex: number
  /** Absolute minute of day the block starts. */
  readonly startMin: number
  /** Absolute minute of day the block ends (exclusive). */
  readonly endMin: number
  readonly kind: string
}

/**
 * Count the evenings in `windowDays` that stayed free of WORK. An evening is consumed only by a
 * work block overlapping the half-open evening window `[eveningStartMin, eveningEndMin)`; life
 * and break blocks never consume one — an evening with only life on it IS a kept-free evening
 * (protecting it for more life would be absurd). Overlap is strict: a day ending exactly at the
 * window start, or starting exactly at its end, does not touch the evening.
 */
export function freeEveningsIn(
  blocks: readonly EveningBlock[],
  windowDays: number,
  eveningStartMin: number = EVENING_START_MIN,
  eveningEndMin: number = EVENING_END_MIN,
): number {
  let free = 0
  for (let day = 0; day < windowDays; day++) {
    const consumed = blocks.some(
      b =>
        b.dayIndex === day &&
        !NON_WORK_KINDS.includes(b.kind) &&
        b.startMin < eveningEndMin &&
        b.endMin > eveningStartMin,
    )
    if (!consumed) free += 1
  }
  return free
}

/**
 * Derive the life-care suggestions from the week's facts. Deterministic order, most urgent
 * first: `life-encroachment` (a concrete clash that already exists) → `no-free-evening` (the
 * whole window's pattern) → `rest-day` (the longitudinal signal). Each fires independently;
 * absence of every signal yields `[]` — an empty week is never an alarm.
 */
export function lifeCareSuggestions(
  input: LifeCareInput,
  restDayThreshold: number = REST_DAY_THRESHOLD_DEFAULT,
): readonly LifeCareSuggestion[] {
  const out: LifeCareSuggestion[] = []
  if (input.encroachingBlockId !== null) {
    out.push({ kind: 'life-encroachment', blockId: input.encroachingBlockId })
  }
  if (input.windowDays >= MIN_EVENING_WINDOW_DAYS && input.eveningsFreeInWindow === 0) {
    out.push({ kind: 'no-free-evening' })
  }
  if (input.consecutiveHeavyDays >= restDayThreshold) {
    out.push({ kind: 'rest-day' })
  }
  return out
}
