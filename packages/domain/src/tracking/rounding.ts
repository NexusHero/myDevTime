import { MINUTE_MS, type DurationMs } from './time.js'

/**
 * Rounding is data, not code paths (REQ-003): a `{ mode, incrementMinutes }`
 * value chosen per project/report and applied at report time. Raw entries stay
 * exact; only aggregated numbers are rounded.
 */
export type RoundingMode = 'none' | 'nearest' | 'up'
export type RoundingIncrementMinutes = 1 | 5 | 6 | 15 | 30 | 60

export interface RoundingRule {
  readonly mode: RoundingMode
  readonly incrementMinutes: RoundingIncrementMinutes
}

export const NO_ROUNDING: RoundingRule = { mode: 'none', incrementMinutes: 1 }

/**
 * Round a duration per the rule. `nearest` rounds a half-increment up (the
 * common billing convention); `up` always ceils to the next increment; `none`
 * is the identity. Never returns a negative value.
 */
export function roundDuration(ms: DurationMs, rule: RoundingRule): DurationMs {
  if (ms < 0) throw new Error('roundDuration: cannot round a negative duration')
  if (rule.mode === 'none') return ms
  const step = rule.incrementMinutes * MINUTE_MS
  const quotient = ms / step
  const units = rule.mode === 'up' ? Math.ceil(quotient) : Math.floor(quotient + 0.5)
  return units * step
}
