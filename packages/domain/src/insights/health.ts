/**
 * Health & Balance core (REQ-058, design v14 §H) — pure and deterministic (ADR-0005),
 * and by design **never a diagnosis** (the "Balance-Feature-Ethik" rule). Two pieces:
 *
 * - **The baseline principle (H3, binding).** Every health signal calibrates to the
 *   person's *own* norm — their >4-week average and spread — **never a fixed threshold**
 *   (">45h = red" is paternalistic and wrong across people). `personalBaseline` summarises
 *   the person's own history; `compareToBaseline` places a current value relative to *their*
 *   distribution, so the same absolute hours read differently for different people.
 * - **The Balance row (H1).** An honest split of waking time into Work / Protected / Free —
 *   "Frei" and "Leben-Logistik" are distinct (a Kita-Abholung is not recovery, §F).
 *
 * No clock, no I/O; the AI may later *explain* a signal, but the numbers are code's.
 */

export interface Baseline {
  /** The person's own mean over the history window. */
  readonly mean: number
  /** Population standard deviation — the person's own scatter. */
  readonly spread: number
  /** How many periods the baseline is built from. */
  readonly n: number
}

/** The minimum own-history periods before we will judge anything (design v14 §H3: ">4 weeks"). */
export const MIN_BASELINE_PERIODS = 4

/**
 * The person's own baseline from their history (e.g. weekly totals), oldest→newest. Returns
 * `null` below `minPeriods` — without enough of the person's *own* data we do not judge, we
 * show an honest empty state. Population spread (÷ n) keeps it deterministic.
 */
export function personalBaseline(
  history: readonly number[],
  minPeriods: number = MIN_BASELINE_PERIODS,
): Baseline | null {
  const n = history.length
  if (n < minPeriods) return null
  const mean = history.reduce((s, x) => s + x, 0) / n
  const variance = history.reduce((s, x) => s + (x - mean) ** 2, 0) / n
  return { mean, spread: Math.sqrt(variance), n }
}

/** Where a current value sits relative to the person's own norm. */
export type BaselineBand = 'below' | 'typical' | 'above'

export interface BaselineComparison {
  readonly band: BaselineBand
  /** Signed deviation from the person's own mean, in their own spreads (0 when spread is 0). */
  readonly z: number
  readonly baseline: Baseline
}

export interface BaselineOptions {
  /** Bands trip at this many of the person's *own* spreads from their mean (default 1). */
  readonly sensitivity?: number
  readonly minPeriods?: number
}

/**
 * Compare a current value to the person's own baseline. The band boundary is a multiple of
 * **their own spread**, not an absolute number — so a 50-hour week is "typical" for someone
 * who normally works 50 and "above" for someone who normally works 40 with a tight spread.
 * Returns `null` without enough own history. With a perfectly steady history (spread 0) any
 * departure is still noted (band moves), but `z` stays 0 rather than dividing by zero.
 */
export function compareToBaseline(
  current: number,
  history: readonly number[],
  opts: BaselineOptions = {},
): BaselineComparison | null {
  const baseline = personalBaseline(history, opts.minPeriods ?? MIN_BASELINE_PERIODS)
  if (baseline === null) return null

  const k = opts.sensitivity ?? 1
  if (baseline.spread === 0) {
    const band: BaselineBand =
      current > baseline.mean ? 'above' : current < baseline.mean ? 'below' : 'typical'
    return { band, z: 0, baseline }
  }
  const z = (current - baseline.mean) / baseline.spread
  const band: BaselineBand = z <= -k ? 'below' : z >= k ? 'above' : 'typical'
  return { band, z, baseline }
}

export interface BalanceInput {
  /** Tracked work minutes in the window. */
  readonly workMin: number
  /** Protected / life-logistics minutes (🛡 and `life` — not recovery, §F). */
  readonly protectedMin: number
  /** Waking minutes in the window; ≤ 0 means unknown (shares fall back to 0). */
  readonly wakingMin: number
}

export interface BalanceRow {
  readonly workMin: number
  readonly protectedMin: number
  /** Waking time that is neither work nor protected: `max(0, waking − work − protected)`. */
  readonly freeMin: number
  readonly workShare: number
  readonly protectedShare: number
  readonly freeShare: number
}

/**
 * The Balance row (H1): split waking time into Work / Protected / Free. "Free" is the honest
 * remainder — and it excludes protected/life-logistics on purpose (a Kita-Abholung is not
 * recovery). Shares are fractions of waking time, or 0 when waking is unknown.
 */
export function balanceRow(input: BalanceInput): BalanceRow {
  const workMin = Math.max(0, input.workMin)
  const protectedMin = Math.max(0, input.protectedMin)
  const freeMin = Math.max(0, input.wakingMin - workMin - protectedMin)
  const waking = input.wakingMin
  const share = (part: number): number => (waking > 0 ? part / waking : 0)
  return {
    workMin,
    protectedMin,
    freeMin,
    workShare: share(workMin),
    protectedShare: share(protectedMin),
    freeShare: share(freeMin),
  }
}
