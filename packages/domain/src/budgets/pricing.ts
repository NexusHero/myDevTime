import type { Instant } from '../tracking/time.js'
import type { Money } from './money.js'
import { resolveRate, type RateRule } from './rates.js'

/**
 * Pricing an individual entry (REQ-005, ADR-0005). A stored rate rule carries the
 * id it applies to (`scopeId`) alongside its level; this module owns the one
 * correctness-sensitive step — selecting the rules applicable to an entry's own
 * client/project/task chain — so the precedence rule has a single definition used
 * by both the server money service and the offline client report.
 */
export interface ScopedRateRule extends RateRule {
  /** The client/project/task id this rate applies to; `null` for the workspace default. */
  readonly scopeId: string | null
}

/** The client/project/task an entry belongs to, for rate selection. */
export interface EntryScope {
  readonly projectId: string | null
  readonly clientId: string | null
  readonly taskId: string | null
}

/** Rules whose level+scope match this entry's chain (workspace/client/project/task). */
export function applicableRules(
  rules: readonly ScopedRateRule[],
  scope: EntryScope,
): ScopedRateRule[] {
  return rules.filter(
    r =>
      (r.level === 'workspace' && r.scopeId === null) ||
      (r.level === 'client' && r.scopeId === scope.clientId) ||
      (r.level === 'project' && r.scopeId === scope.projectId) ||
      (r.level === 'task' && r.scopeId === scope.taskId),
  )
}

/**
 * The minor-units-per-hour rate in effect for an entry at `at`, resolving
 * task → project → client → workspace precedence, or `null` when no level has a
 * rate in effect (unpriced work). Effective-dating stays non-retroactive
 * (`resolveRate`), so the entry is priced with the rate that was in effect at its
 * own start.
 */
export function rateForEntry(
  rules: readonly ScopedRateRule[],
  scope: EntryScope,
  at: Instant,
): Money | null {
  return resolveRate(applicableRules(rules, scope), at)?.amountMinorPerHour ?? null
}
