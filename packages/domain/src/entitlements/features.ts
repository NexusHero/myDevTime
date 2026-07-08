import type { Entitlement, Plan } from './types.js'

/**
 * Feature gating (REQ-016, ADR-0006). Every gate in every client and module asks
 * `can(entitlement, feature)` — never a payment SDK, never a plan string compare
 * scattered across the codebase. The plan→feature matrix lives here so the
 * boundary between free and Pro is one table, not a hunt.
 */

export type Feature =
  | 'basic_tracking' // timers, manual entries, local reports — free forever
  | 'unlimited_projects' // free is capped; Pro lifts it
  | 'calendar_integration' // auto-capture from calendars
  | 'ai_proposals' // rule-undecided categorization suggestions
  | 'meeting_transcription' // capture + transcript + insights
  | 'advanced_reports' // invoice-ready export, budget burn-down

const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1 }

/** The minimum plan each feature requires. Absent = free. */
const FEATURE_MIN_PLAN: Record<Feature, Plan> = {
  basic_tracking: 'free',
  unlimited_projects: 'pro',
  calendar_integration: 'pro',
  ai_proposals: 'pro',
  meeting_transcription: 'pro',
  advanced_reports: 'pro',
}

/**
 * Whether an entitlement unlocks a feature. `past_due` still entitles (the
 * dunning grace keeps `plan === 'pro'`), so no need to special-case it here.
 */
export function can(entitlement: Entitlement, feature: Feature): boolean {
  return PLAN_RANK[entitlement.plan] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]]
}

/** Features unlocked by a plan — handy for shipping the gate set to a client. */
export function featuresFor(plan: Plan): readonly Feature[] {
  return (Object.keys(FEATURE_MIN_PLAN) as Feature[]).filter(
    f => PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN_PLAN[f]],
  )
}
