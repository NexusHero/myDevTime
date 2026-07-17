import { costOf, type Money } from '../budgets/money.js'
import { MINUTE_MS, type DurationMs } from '../tracking/time.js'

/**
 * Price of the week (REQ-050, ADR-0065 · design v13 G1) — the deterministic solver
 * behind the panel that opens after Fill-week. It answers "what does this week *cost*
 * you?" for three intensities the user slides between: **sustainable** spreads the
 * workload across every available day near the daily target; **dense** packs it into
 * the fewest days, buying free days with longer, higher-strain ones; **balanced** sits
 * between. Every figure — active days, per-day load, overtime, revenue, a 0..100 strain
 * score — is rule-based (ADR-0005); the AI never places a block.
 */

export type WeekIntensity = 'sustainable' | 'balanced' | 'dense'

export const WEEK_INTENSITIES: readonly WeekIntensity[] = ['sustainable', 'balanced', 'dense']

export interface WeekLoadInput {
  /** Total work to place across the week, in ms. */
  readonly totalWorkMs: DurationMs
  /** Days available to work in (e.g. 5). Must be ≥ 1. */
  readonly availableDays: number
  /** Contracted daily target, in ms (e.g. 8h20 = 500 min). Must be > 0. */
  readonly targetDailyMs: DurationMs
  /** Of `totalWorkMs`, the billable portion, in ms (0..totalWorkMs). */
  readonly billableWorkMs: DurationMs
  /** Average billable rate, integer minor units per hour. */
  readonly ratePerHourMinor: Money
}

export interface WeekPrice {
  readonly intensity: WeekIntensity
  /** Days that carry work under this intensity. */
  readonly activeDays: number
  /** Even per-active-day load, in ms. */
  readonly perDayMs: DurationMs
  /** Overtime beyond target summed across active days, in ms. */
  readonly overtimeMs: DurationMs
  /** Free days won (available − active). */
  readonly freeDays: number
  /** Billable revenue for the week (intensity-independent), minor units. */
  readonly revenueMinor: Money
  /** Strain indicator 0..100: how hard the peak day and overtime push past target. */
  readonly loadScore: number
}

/**
 * The per-day fill target as a fraction of the contracted daily target, per intensity.
 * Sustainable under-fills (spreads across more days, lower strain); dense over-fills
 * (packs into fewer days, buying free days with longer ones). This fraction is what the
 * intensity slider moves.
 */
function fillFraction(intensity: WeekIntensity): number {
  switch (intensity) {
    case 'sustainable':
      return 0.75
    case 'balanced':
      return 1
    case 'dense':
      return 1.6
  }
}

/** The densest intensity's fill, used to normalise the strain score across intensities. */
const MAX_FILL = 1.6

/**
 * Price one intensity. Work spreads evenly over the fewest days needed to hit the
 * intensity's per-day fill target, clamped to `availableDays`. Sustainable therefore
 * uses more, lighter days; dense fewer, heavier ones. When the workload exceeds even
 * `availableDays` at the dense fill, it spreads across every available day (honest
 * overflow — the panel then shows the overtime it costs).
 */
export function priceWeekAt(input: WeekLoadInput, intensity: WeekIntensity): WeekPrice {
  if (input.availableDays < 1) throw new Error('availableDays must be at least 1')
  if (input.targetDailyMs <= 0) throw new Error('targetDailyMs must be positive')
  if (input.billableWorkMs < 0 || input.billableWorkMs > input.totalWorkMs) {
    throw new Error('billableWorkMs must be within [0, totalWorkMs]')
  }

  const fillPerDay = input.targetDailyMs * fillFraction(intensity)
  const neededDays = input.totalWorkMs <= 0 ? 0 : Math.ceil(input.totalWorkMs / fillPerDay)
  const activeDays = Math.min(
    input.availableDays,
    Math.max(neededDays, input.totalWorkMs > 0 ? 1 : 0),
  )

  const perDayMs = activeDays === 0 ? 0 : Math.round(input.totalWorkMs / activeDays)
  const overPerDay = Math.max(0, perDayMs - input.targetDailyMs)
  const overtimeMs = overPerDay * activeDays
  const freeDays = input.availableDays - activeDays

  const revenueMinor = costOf(input.ratePerHourMinor, input.billableWorkMs)

  // Strain 0..100: how far the day pushes past target, normalised to the densest fill's
  // headroom so intensities are comparable, plus a small penalty when overtime spans
  // many days rather than a single crunch day.
  const overRatio = overPerDay / input.targetDailyMs
  const peakStrain = Math.min(1, overRatio / (MAX_FILL - 1))
  const spreadPenalty = overtimeMs > 0 ? Math.min(0.2, (activeDays / input.availableDays) * 0.2) : 0
  const loadScore = Math.round(Math.min(1, peakStrain * 0.8 + spreadPenalty) * 100)

  return { intensity, activeDays, perDayMs, overtimeMs, freeDays, revenueMinor, loadScore }
}

/** Price all three intensities, sustainable → dense. Revenue is identical across them
 *  (same work, same rate); what changes is how the week feels. */
export function priceWeek(input: WeekLoadInput): WeekPrice[] {
  return WEEK_INTENSITIES.map(i => priceWeekAt(input, i))
}

/** Convenience: build a load input from minutes, the unit the planner UI carries. */
export function weekLoadFromMinutes(args: {
  readonly totalWorkMin: number
  readonly availableDays: number
  readonly targetDailyMin: number
  readonly billableWorkMin: number
  readonly ratePerHourMinor: Money
}): WeekLoadInput {
  return {
    totalWorkMs: args.totalWorkMin * MINUTE_MS,
    availableDays: args.availableDays,
    targetDailyMs: args.targetDailyMin * MINUTE_MS,
    billableWorkMs: args.billableWorkMin * MINUTE_MS,
    ratePerHourMinor: args.ratePerHourMinor,
  }
}
