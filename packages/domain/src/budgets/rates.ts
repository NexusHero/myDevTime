import type { Instant } from '../tracking/time.js'
import type { Money } from './money.js'

/**
 * Hourly-rate resolution (REQ-005). A rate is chosen by **specificity first,
 * effective date second**: the most specific level that has any rate in effect
 * wins — task over project over client over workspace — and within that level
 * the latest rate whose `effectiveFrom` is at or before the entry's instant.
 *
 * Effective-dating is non-retroactive by construction: an entry is always priced
 * with the rate that was in effect *at the entry's own time*, so changing a rate
 * today never rewrites the value of last month's work (ADR-0005). This function
 * is pure — the caller passes the rules applicable to the entry's chain.
 */

export type RateLevel = 'workspace' | 'client' | 'project' | 'task'

/** Most-specific first — the order precedence walks. */
const BY_SPECIFICITY: readonly RateLevel[] = ['task', 'project', 'client', 'workspace']

export interface RateRule {
  readonly level: RateLevel
  /** Rate in integer minor units per hour. */
  readonly amountMinorPerHour: Money
  /** The instant from which this rate applies (inclusive). */
  readonly effectiveFrom: Instant
}

/**
 * The rate in effect for an entry at `at`, or `null` if no level has a rate
 * effective yet. `rules` may mix levels and dates freely.
 */
export function resolveRate(rules: readonly RateRule[], at: Instant): RateRule | null {
  for (const level of BY_SPECIFICITY) {
    let best: RateRule | null = null
    for (const rule of rules) {
      if (rule.level !== level) continue
      if (rule.effectiveFrom > at) continue // not yet in effect for this entry
      if (best === null || rule.effectiveFrom > best.effectiveFrom) best = rule
    }
    if (best !== null) return best
  }
  return null
}

/** The effective rate's amount, or 0 when nothing is in effect (unpriced work). */
export function rateAmountAt(rules: readonly RateRule[], at: Instant): Money {
  return resolveRate(rules, at)?.amountMinorPerHour ?? 0
}
