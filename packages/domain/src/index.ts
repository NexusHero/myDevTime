export { assertNever, clamp } from './util.js'

// Deterministic tracking core (REQ-003, ADR-0005).
export type { Instant, DurationMs, TimeZone, LocalParts } from './tracking/time.js'
export {
  MINUTE_MS,
  HOUR_MS,
  DAY_MS,
  localParts,
  tzOffsetMs,
  zonedTimeToInstant,
  startOfLocalDay,
  startOfNextLocalDay,
  startOfLocalWeek,
  isoWeekday,
  dayKey,
  weekKey,
  monthKey,
} from './tracking/time.js'
export type { TimeEntry, EntrySource } from './tracking/time-entry.js'
export { isRunning, entryDuration, isValidEntry } from './tracking/time-entry.js'
export type { RoundingMode, RoundingIncrementMinutes, RoundingRule } from './tracking/rounding.js'
export { NO_ROUNDING, roundDuration } from './tracking/rounding.js'
export type { OverlapPolicy, OverlapConflict } from './tracking/overlap.js'
export { findOverlaps, hasOverlaps, autoTrimOverlaps, stopRunningAt } from './tracking/overlap.js'
export type {
  Granularity,
  GroupDimension,
  AggregateOptions,
  Bucket,
} from './tracking/aggregation.js'
export { aggregate } from './tracking/aggregation.js'

// Deterministic cross-device sync core (REQ-006, ADR-0019).
export type { SyncEntityType, SyncValue, EntityState, Resolution } from './sync/types.js'
export { resolve } from './sync/resolve.js'
export type {
  ServerRecord,
  SyncServer,
  PushChange,
  PushResult,
  PushResponse,
  PullResponse,
} from './sync/engine.js'
export { emptyServer, entityKey, applyPush, pull } from './sync/engine.js'

// Money, rates & budgets (REQ-005, ADR-0005) — integer minor units, no float.
export type { Money, MoneyRounding } from './budgets/money.js'
export { costOf, sumMoney, hoursToMs } from './budgets/money.js'
export type { RateLevel, RateRule } from './budgets/rates.js'
export { resolveRate, rateAmountAt } from './budgets/rates.js'
export type {
  BudgetBasis,
  BudgetPeriod,
  Budget,
  BudgetStatus,
  ThresholdEvaluation,
  DeadlineStatus,
} from './budgets/budget.js'
export {
  budgetStatus,
  consumedDuration,
  evaluateThresholds,
  deadlineStatus,
  isDueWithin,
} from './budgets/budget.js'

// Timesheet reporting (REQ-009, ADR-0005) — the single source every export serializes.
export type {
  TimesheetGroupBy,
  TimesheetEntryInput,
  TimesheetOptions,
  TimesheetLine,
  Timesheet,
} from './reporting/timesheet.js'
export { buildTimesheet } from './reporting/timesheet.js'
export type { ProjectSummary, WorkspaceSummary, SummaryOptions } from './reporting/summary.js'
export { summarizeEntries } from './reporting/summary.js'

// Entitlements — the domain of monetization (REQ-016, ADR-0006/0008). Provider-
// agnostic plan/state machine; payment providers are adapters layered on later.
export type {
  Plan,
  EntitlementSource,
  EntitlementStatus,
  EntitlementEventType,
  EntitlementEvent,
  Entitlement,
} from './entitlements/types.js'
export { FREE } from './entitlements/types.js'
export { deriveEntitlement } from './entitlements/derive.js'
export type { Feature } from './entitlements/features.js'
export { can, featuresFor } from './entitlements/features.js'
