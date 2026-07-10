import type { DurationMs } from '../tracking/time.js'
import { MINUTE_MS } from '../tracking/time.js'
import { isValidShift, type Shift } from './worktime.js'

/**
 * The configurable break-rule check (REQ-028, ADR-0010). A **hint engine, not
 * legal certification**: given a shift's gross span it computes the minimum break
 * a preset requires and reports any shortfall as a warning. Deterministic and pure
 * (ADR-0005); the German **ArbZG §4** preset is provided, but the tiers are data
 * so other jurisdictions/policies plug in without code changes.
 */

/** One tier of a break rule: above `minGrossMs` worked, at least `minBreakMs`. */
export interface BreakRuleTier {
  readonly minGrossMs: DurationMs
  readonly minBreakMs: DurationMs
}

/** A preset is tiers in ascending `minGrossMs` order. */
export type BreakRulePreset = readonly BreakRuleTier[]

/**
 * German Arbeitszeitgesetz §4: more than 6h worked → ≥30 min break; more than 9h
 * → ≥45 min. Thresholds are exclusive (exactly 6h needs no break).
 */
export const ARBZG_PRESET: BreakRulePreset = [
  { minGrossMs: 6 * 60 * MINUTE_MS, minBreakMs: 30 * MINUTE_MS },
  { minGrossMs: 9 * 60 * MINUTE_MS, minBreakMs: 45 * MINUTE_MS },
]

/** The minimum break a preset requires for a `grossMs` span (highest matching tier). */
export function requiredBreakMs(grossMs: DurationMs, preset: BreakRulePreset): DurationMs {
  let required = 0
  for (const tier of preset) {
    if (grossMs > tier.minGrossMs) required = Math.max(required, tier.minBreakMs)
  }
  return required
}

/** How far a shift's break falls short of the preset (0 when compliant or invalid). */
export function breakShortfallMs(shift: Shift, preset: BreakRulePreset): DurationMs {
  if (!isValidShift(shift)) return 0
  const gross = shift.end - shift.start
  return Math.max(0, requiredBreakMs(gross, preset) - shift.breakMs)
}

/** Whether a shift breaks the preset (its break is shorter than required). */
export function hasBreakViolation(shift: Shift, preset: BreakRulePreset): boolean {
  return breakShortfallMs(shift, preset) > 0
}
