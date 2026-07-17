import { HOUR_MS, type DurationMs } from '../tracking/time.js'

/**
 * Overtime compound (REQ-049, ADR-0065 · design v13 G3) — turns a run of weekly
 * overtime deltas into the compounding picture the Profile screen shows: the running
 * balance week by week (the sparkline), a straight-line forecast of where it lands if
 * the pattern holds, and a plain-language pattern note. Pure and deterministic
 * (ADR-0005): ordinary least-squares over the observed weeks, no AI, no I/O. Every
 * value is milliseconds so it stays integer-friendly and unit-consistent with the
 * attendance layer.
 */

/** One observed week: its net overtime (worked − target), signed, in ms. */
export interface OvertimeWeek {
  /** Local start-of-week instant, used only for ordering/labelling. */
  readonly weekStartMs: number
  /** Net overtime for the week: positive over target, negative under. */
  readonly deltaMs: DurationMs
}

/** A point on the compounding balance line: cumulative overtime through this week. */
export interface OvertimePoint {
  readonly weekStartMs: number
  readonly balanceMs: DurationMs
}

export type OvertimeTrend = 'accumulating' | 'reducing' | 'stable'

export interface OvertimeForecast {
  /** Cumulative balance after each observed week, in input order. */
  readonly series: readonly OvertimePoint[]
  /** The current balance (last cumulative point), or 0 with no weeks. */
  readonly currentMs: DurationMs
  /** Average change in balance per week from the fitted line, in ms (the slope). */
  readonly slopePerWeekMs: number
  /** Projected balance `horizonWeeks` ahead if the trend holds, in ms. */
  readonly projectedMs: DurationMs
  /** How the balance is moving. `stable` when |slope| is under `stableBandMs`. */
  readonly trend: OvertimeTrend
  /** A short, deterministic pattern note (English) for the UI. */
  readonly note: string
}

export interface OvertimeForecastOptions {
  /** Weeks to project past the last observed week (default 4). */
  readonly horizonWeeks?: number
  /** |slope| below this counts as `stable` (default 30 min/week). */
  readonly stableBandMs?: number
}

/** Least-squares slope of y over x = 0,1,2,… Returns 0 for fewer than two points. */
function fitSlope(ys: readonly number[]): number {
  const n = ys.length
  if (n < 2) return 0
  const meanX = (n - 1) / 2
  let meanY = 0
  for (const y of ys) meanY += y
  meanY /= n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    const dx = i - meanX
    num += dx * ((ys[i] ?? 0) - meanY)
    den += dx * dx
  }
  return den === 0 ? 0 : num / den
}

function formatHm(ms: number): string {
  const sign = ms < 0 ? '−' : ''
  const abs = Math.abs(ms)
  const h = Math.floor(abs / HOUR_MS)
  const m = Math.round((abs % HOUR_MS) / 60_000)
  return `${sign}${String(h)}h ${String(m).padStart(2, '0')}m`
}

/**
 * Fold weekly overtime deltas into the compounding balance, fit a straight line to it,
 * and project `horizonWeeks` ahead. Weeks are taken in the order given (already sorted
 * by the caller). With no weeks the forecast is an honest zero.
 */
export function overtimeForecast(
  weeks: readonly OvertimeWeek[],
  opts: OvertimeForecastOptions = {},
): OvertimeForecast {
  const horizon = opts.horizonWeeks ?? 4
  const stableBand = opts.stableBandMs ?? 30 * 60_000

  const series: OvertimePoint[] = []
  let running = 0
  for (const w of weeks) {
    running += w.deltaMs
    series.push({ weekStartMs: w.weekStartMs, balanceMs: running })
  }
  const currentMs = series.length === 0 ? 0 : (series[series.length - 1]?.balanceMs ?? 0)

  const slope = fitSlope(series.map(p => p.balanceMs))
  const projectedMs = Math.round(currentMs + slope * horizon)

  const trend: OvertimeTrend =
    Math.abs(slope) < stableBand ? 'stable' : slope > 0 ? 'accumulating' : 'reducing'

  let note: string
  if (series.length < 2) {
    note = 'Not enough weeks yet to read a trend.'
  } else if (trend === 'stable') {
    note = `Your overtime balance is holding steady around ${formatHm(currentMs)}.`
  } else if (trend === 'accumulating') {
    note = `Overtime is compounding by about ${formatHm(slope)} a week — on track for ${formatHm(projectedMs)} in ${String(horizon)} weeks.`
  } else {
    note = `You're paying overtime down by about ${formatHm(Math.abs(slope))} a week — heading toward ${formatHm(projectedMs)} in ${String(horizon)} weeks.`
  }

  return { series, currentMs, slopePerWeekMs: slope, projectedMs, trend, note }
}
