/**
 * Task effort estimation (REQ-041, ADR-0005) — pure and deterministic. A category + complexity map
 * to an **hours range**, never a single number: a baseline that is honest about its own imprecision
 * (a point estimate would fake a precision the data does not have). The user's own estimate, when
 * given, takes precedence and is recorded with `user` provenance; the baseline carries `baseline`
 * provenance. An AI review may *suggest* a number elsewhere (assist-only) — it never mutates the
 * stored estimate, and this core needs no AI to work. Once the task is tracked, `estimateVsActual`
 * compares the chosen estimate against reality.
 */

export type TaskComplexity = 'trivial' | 'small' | 'medium' | 'large' | 'xlarge'

/** Broad work category; scales the base range (research/uncertainty widens it). */
export type TaskCategory = 'feature' | 'bug' | 'chore' | 'research' | 'meeting'

/** An hours range — `minHours <= maxHours`. Baselines are ranges by design (no false precision). */
export interface EstimateRange {
  readonly minHours: number
  readonly maxHours: number
}

/** Base ranges per complexity (hours), before the category factor. */
const COMPLEXITY_BASE: Record<TaskComplexity, EstimateRange> = {
  trivial: { minHours: 0.25, maxHours: 1 },
  small: { minHours: 1, maxHours: 3 },
  medium: { minHours: 3, maxHours: 8 },
  large: { minHours: 8, maxHours: 20 },
  xlarge: { minHours: 20, maxHours: 45 },
}

/** Category multiplier — research is the most uncertain, chores the tightest. */
const CATEGORY_FACTOR: Record<TaskCategory, number> = {
  feature: 1,
  bug: 1.1, // bugs hide surprises
  chore: 0.8,
  research: 1.5, // widest band
  meeting: 0.6,
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * The deterministic baseline range for a category + complexity. Pure lookup × factor, rounded to
 * two decimals; always `minHours <= maxHours`.
 */
export function baselineRange(category: TaskCategory, complexity: TaskComplexity): EstimateRange {
  const base = COMPLEXITY_BASE[complexity]
  const factor = CATEGORY_FACTOR[category]
  return { minHours: round2(base.minHours * factor), maxHours: round2(base.maxHours * factor) }
}

/** The midpoint of a range — used only when a single number is unavoidable (display/compare). */
export function rangeMidpoint(range: EstimateRange): number {
  return round2((range.minHours + range.maxHours) / 2)
}

export type EstimateProvenance = 'baseline' | 'user'

export interface ResolvedEstimate {
  /** The deterministic baseline range (always present, for context). */
  readonly baseline: EstimateRange
  /** The user's own point estimate in hours, when they set one. */
  readonly userHours: number | null
  /** Which estimate governs: the user's number if set, else the baseline. */
  readonly provenance: EstimateProvenance
  /** The single number to plan against: the user's hours, else the baseline midpoint. */
  readonly effectiveHours: number
}

/**
 * Resolve the effective estimate: the user's own number wins over the baseline (their judgement is
 * authoritative — the baseline only seeds it), and provenance records which. A non-finite or
 * negative user value is ignored (treated as unset), never trusted.
 */
export function resolveEstimate(
  category: TaskCategory,
  complexity: TaskComplexity,
  userHours?: number | null,
): ResolvedEstimate {
  const baseline = baselineRange(category, complexity)
  const validUser = typeof userHours === 'number' && Number.isFinite(userHours) && userHours >= 0
  return {
    baseline,
    userHours: validUser ? round2(userHours) : null,
    provenance: validUser ? 'user' : 'baseline',
    effectiveHours: validUser ? round2(userHours) : rangeMidpoint(baseline),
  }
}

export interface EstimateVsActual {
  readonly estimateHours: number
  readonly actualHours: number
  /** Signed hours (actual − estimate): positive = over the estimate. */
  readonly deltaHours: number
  /** Rounded signed percentage vs the estimate, or `null` when the estimate is zero. */
  readonly variancePct: number | null
  readonly status: 'over' | 'under' | 'on'
}

/**
 * Compare the chosen estimate against tracked actual hours once the task is done. Signed delta,
 * rounded variance, banded `over`/`on`/`under` within a tolerance (default 10 %). Pure; a zero
 * estimate yields a `null` percentage (status still follows the sign of the delta).
 */
export function estimateVsActual(
  estimateHours: number,
  actualHours: number,
  opts?: { readonly tolerancePct?: number },
): EstimateVsActual {
  const tolerance = opts?.tolerancePct ?? 10
  const deltaHours = round2(actualHours - estimateHours)
  const variancePct = estimateHours === 0 ? null : Math.round((deltaHours / estimateHours) * 100)
  const status: EstimateVsActual['status'] =
    variancePct === null
      ? deltaHours > 0
        ? 'over'
        : deltaHours < 0
          ? 'under'
          : 'on'
      : variancePct > tolerance
        ? 'over'
        : variancePct < -tolerance
          ? 'under'
          : 'on'
  return {
    estimateHours: round2(estimateHours),
    actualHours: round2(actualHours),
    deltaHours,
    variancePct,
    status,
  }
}
