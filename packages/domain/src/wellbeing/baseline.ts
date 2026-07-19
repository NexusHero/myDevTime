/**
 * Evening Companion / Wellbeing — longitudinal baseline (design v14 §H3 "baseline principle",
 * ADR-0005). Pure and deterministic. Over a series of past daily load scores (the `loadScore`
 * from `reviewDay`) it derives the person's **own** normal band, a coarse trend, and a set of
 * deterministic pattern flags. It never judges against a fixed threshold — calibration is to
 * the person's own history (the binding H3 rule reused from `insights/health.personalBaseline`).
 *
 * Short histories are handled honestly: below `MIN_BASELINE_DAYS` we do not have enough of the
 * person's own data to judge, so the band is **wide** (`[0, ∞)` — nothing reads as abnormal),
 * the trend is `steady`, and no pattern flags fire. No clock, no I/O: weekday context is passed
 * in as data. A signal that cannot be computed is absent, never guessed.
 */

import { LOAD_BAND_HEAVY } from './dayReview.js'

/** One past day: its load score plus the weekday it fell on (0–6, provided as data — no clock). */
export interface BaselineDay {
  readonly loadScore: number
  /** Weekday index (any stable 0–6 encoding). Used only to group by weekday; the mapping is the caller's. */
  readonly weekday: number
}

/** The coarse direction of load over the window. */
export type LoadTrend = 'rising' | 'steady' | 'falling'

export interface ConsecutiveHeavyDaysFlag {
  readonly kind: 'consecutive-heavy-days'
  readonly detail: { readonly runLength: number }
}
export interface WeekdayOverbookFlag {
  readonly kind: 'weekday-overbook'
  readonly detail: {
    readonly weekday: number
    readonly weekdayMean: number
    readonly overallMean: number
  }
}

/** A deterministic longitudinal pattern worth surfacing. */
export type PatternFlag = ConsecutiveHeavyDaysFlag | WeekdayOverbookFlag

/** The closed set of pattern-flag kinds — the contract the AI narration + Today card wire against. */
export type PatternFlagKind = PatternFlag['kind']

export interface WellbeingBaseline {
  /** Lower edge of the person's own normal load band (`max(0, mean − spread)`; 0 on short history). */
  readonly normalLow: number
  /** Upper edge of the person's own normal band (`mean + spread`; `+∞` on short history). */
  readonly normalHigh: number
  readonly trend: LoadTrend
  /** Deterministic patterns, in a stable order: consecutive-heavy first, then overbooked weekdays ascending. */
  readonly patternFlags: readonly PatternFlag[]
}

// ─── Documented thresholds ────────────────────────────────────────────────────────────────

/** Below this many days we do not judge: wide band, steady trend, no flags (cf. `insights/health` MIN_BASELINE_PERIODS). */
export const MIN_BASELINE_DAYS = 5
/** A day counts as "heavy" for the run flag once its load reaches the heavy band (reused from `dayReview`). */
export const HEAVY_LOAD_SCORE = LOAD_BAND_HEAVY
/** `consecutive-heavy-days` fires when this many heavy days occur in a row. */
export const CONSECUTIVE_HEAVY_MINIMUM = 3
/** A weekday needs at least this many samples before it can be flagged as overbooked. */
export const MIN_WEEKDAY_SAMPLES = 2
/** A weekday is "overbooked" when its mean load exceeds the overall mean by at least this many points. */
export const WEEKDAY_OVERBOOK_DELTA = 2
/** The later half's mean must beat the earlier half's by this much to read as rising/falling. */
export const TREND_DELTA = 1

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, x) => s + x, 0) / values.length
}

/** Population standard deviation (÷ n) — the person's own scatter, kept deterministic. */
function spread(values: readonly number[], m: number): number {
  if (values.length === 0) return 0
  const variance = values.reduce((s, x) => s + (x - m) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/** The longest run of consecutive heavy days (loadScore ≥ heavy band). */
function longestHeavyRun(days: readonly BaselineDay[]): number {
  let best = 0
  let run = 0
  for (const day of days) {
    if (day.loadScore >= HEAVY_LOAD_SCORE) {
      run += 1
      if (run > best) best = run
    } else {
      run = 0
    }
  }
  return best
}

/** Coarse trend from the earlier vs later half of the (oldest→newest) series. */
function trendOf(days: readonly BaselineDay[]): LoadTrend {
  const half = Math.floor(days.length / 2)
  const earlier = mean(days.slice(0, half).map(d => d.loadScore))
  const later = mean(days.slice(days.length - half).map(d => d.loadScore))
  const delta = later - earlier
  if (delta >= TREND_DELTA) return 'rising'
  if (delta <= -TREND_DELTA) return 'falling'
  return 'steady'
}

/** Weekdays whose own mean load runs well above the overall mean, ascending by weekday. */
function overbookedWeekdays(
  days: readonly BaselineDay[],
  overallMean: number,
): WeekdayOverbookFlag[] {
  const byWeekday = new Map<number, number[]>()
  for (const day of days) {
    const bucket = byWeekday.get(day.weekday)
    if (bucket) bucket.push(day.loadScore)
    else byWeekday.set(day.weekday, [day.loadScore])
  }
  const flags: WeekdayOverbookFlag[] = []
  for (const weekday of [...byWeekday.keys()].sort((a, b) => a - b)) {
    const scores = byWeekday.get(weekday) ?? []
    if (scores.length < MIN_WEEKDAY_SAMPLES) continue
    const weekdayMean = mean(scores)
    if (weekdayMean - overallMean >= WEEKDAY_OVERBOOK_DELTA) {
      flags.push({ kind: 'weekday-overbook', detail: { weekday, weekdayMean, overallMean } })
    }
  }
  return flags
}

/**
 * The person's own load baseline over `days` (oldest→newest). Below `MIN_BASELINE_DAYS` there
 * isn't enough of their own history to judge, so the band is wide (`[0, +∞)`), the trend is
 * `steady`, and no flags fire — an honest empty state rather than a verdict from thin data.
 * With enough history the normal band is `mean ± own-spread` (population spread, deterministic),
 * clamped at 0 below; the trend compares the later half of the window to the earlier half; and
 * pattern flags surface consecutive heavy days and weekdays whose mean load runs well above the
 * person's own overall mean.
 */
export function computeBaseline(days: readonly BaselineDay[]): WellbeingBaseline {
  if (days.length < MIN_BASELINE_DAYS) {
    return {
      normalLow: 0,
      normalHigh: Number.POSITIVE_INFINITY,
      trend: 'steady',
      patternFlags: [],
    }
  }

  const scores = days.map(d => d.loadScore)
  const m = mean(scores)
  const s = spread(scores, m)

  const patternFlags: PatternFlag[] = []
  const heavyRun = longestHeavyRun(days)
  if (heavyRun >= CONSECUTIVE_HEAVY_MINIMUM) {
    patternFlags.push({ kind: 'consecutive-heavy-days', detail: { runLength: heavyRun } })
  }
  patternFlags.push(...overbookedWeekdays(days, m))

  return {
    normalLow: Math.max(0, m - s),
    normalHigh: m + s,
    trend: trendOf(days),
    patternFlags,
  }
}
