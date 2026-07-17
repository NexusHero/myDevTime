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
export { normalizeQuery, matchesNoteQuery, searchEntriesByNote } from './tracking/search.js'
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
export type { CrudOp, CrudWrite, ServerRow, CrudDecision } from './sync/crud.js'
export { resolveCrudWrite } from './sync/crud.js'

// Money, rates & budgets (REQ-005, ADR-0005) — integer minor units, no float.
export type { Money, MoneyRounding } from './budgets/money.js'
export { costOf, sumMoney, hoursToMs } from './budgets/money.js'
export type { RateLevel, RateRule } from './budgets/rates.js'
export { resolveRate, rateAmountAt } from './budgets/rates.js'
export type { ScopedRateRule, EntryScope } from './budgets/pricing.js'
export { applicableRules, rateForEntry } from './budgets/pricing.js'
export type {
  BudgetBasis,
  BudgetPeriod,
  Budget,
  BudgetStatus,
  BurndownPoint,
  BurndownProjection,
  ThresholdEvaluation,
  DeadlineStatus,
} from './budgets/budget.js'
export {
  budgetStatus,
  consumedDuration,
  burndownProjection,
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
export type {
  ProjectCost,
  BillingBreakdown,
  BudgetLimit,
  BudgetConsumption,
} from './reporting/finance.js'
export { priceBillableEntries, budgetConsumptions } from './reporting/finance.js'
export type {
  ClientRevenue,
  OpenItem,
  AgingKey,
  AgingBucket,
  AgingReport,
  AgingOptions,
} from './reporting/rollups.js'
export { revenueByClient, effectiveRateMinorPerHour, agingBuckets } from './reporting/rollups.js'

// Invoicing / "Abrechnung" (design v6, REQ-005/009) — the deterministic freelancer
// billing flow: priced invoice lines + a selectable draft total, same money math.
export type { InvoiceLine, InvoiceDraft, InvoiceWindow } from './invoicing/invoice.js'
export { invoiceLines, summarizeInvoice } from './invoicing/invoice.js'

// Attendance work-day core (REQ-028, ADR-0010) — punch-pair math + overtime
// balance against a weekly target + the ArbZG §4 break-rule check; deterministic,
// LLM-free (ADR-0005).
export type { Shift, WeeklyTarget, OvertimeRange, OvertimeBalance } from './attendance/worktime.js'
export { isValidShift, shiftNetMs, targetForDay, computeOvertime } from './attendance/worktime.js'
export type { BreakRuleTier, BreakRulePreset } from './attendance/break-rule.js'
export {
  ARBZG_PRESET,
  requiredBreakMs,
  breakShortfallMs,
  hasBreakViolation,
} from './attendance/break-rule.js'
export type { WorktimeReportDay, WorktimeReport, WorktimeReportInput } from './attendance/report.js'
export { buildWorktimeReport } from './attendance/report.js'
export type { BookedInterval, CoverageReport } from './attendance/coverage.js'
export { reconcileCoverage } from './attendance/coverage.js'
export type { HolidayRegion } from './absences/holidays.js'
export { easterSunday, holidaysForRegion, HOLIDAY_REGIONS } from './absences/holidays.js'
export type { PlanLabel } from './planner/label.js'
export { deterministicLabels } from './planner/label.js'

// Absences (REQ-029, ADR-0010) — leave as inclusive calendar-date ranges +
// vacation-allowance balance; deterministic, LLM-free (ADR-0005).
export type { AbsenceKind, Absence, AbsencePolicy, VacationBalance } from './absences/absence.js'
export { inclusiveDayCount, absenceDays, coversDate, vacationBalance } from './absences/absence.js'

// Co-Planner (REQ-031, ADR-0011) — deterministic day-plan algorithm (meetings
// anchor, focus fills gaps by priority, breaks satisfy the rules); the LLM only
// ranks/labels within these code-enforced blocks (ADR-0005).
export type {
  PlanBlockKind,
  PlanBlock,
  PlanAnchor,
  PlanCandidate,
  PlanInput,
  DayPlan,
  PlanReview,
} from './planner/plan.js'
export { buildDayPlan, reviewDayPlan } from './planner/plan.js'

// AI-credit ledger (REQ-027, ADR-0008) — append-only signed deltas; balance +
// usage derived from the log; deterministic, LLM-free (ADR-0005).
export type { CreditEntryKind, CreditEntry, UsageBucket } from './credits/ledger.js'
export { creditBalance, usageByCategory, canDebit } from './credits/ledger.js'
export type { TopUpPack } from './credits/allowance.js'
export { monthlyCreditAllowance, TOPUP_PACKS, topUpPackCredits } from './credits/allowance.js'

// Natural-language time entry (REQ-013, ADR-0005) — deterministic pre-parser that
// turns a phrase into a draft the user confirms; LLM only for what it can't parse.
export type { TimeEntryDraft, ParseOptions } from './nlentry/parse.js'
export { parseTimeEntry } from './nlentry/parse.js'

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

// Auto-Tracker (REQ-042, ADR-0057) — deterministic aggregation of "app usage while
// tracking" spans into a percentage-correct breakdown. OS/browser capture is a
// client adapter behind a narrow port; this core is pure and framework-free (ADR-0005).
export type {
  ActivitySample,
  ActivitySegment,
  ActivityBreakdown,
  SummarizeOptions,
} from './autotracker/activity.js'
export { summarizeActivity } from './autotracker/activity.js'
export type { TimedSpan, BookedSpan, RealityGap, RealityOptions } from './autotracker/reality.js'
export { trackedMs, realityDrift, detectUnbookedGap } from './autotracker/reality.js'

// Focus streak + workload balance (REQ-032, ADR-0012) — deterministic wellbeing
// signals over real tracked time (ADR-0005). The balance level is a neutral
// workload metric (actual vs target), never a diagnosis.
export type {
  DayFocus,
  StreakOptions,
  LoadLevel,
  LoadInput,
  Load,
  FocusQuartiles,
} from './insights/balance.js'
export {
  focusStreak,
  workloadLoad,
  weeklyFocusTrend,
  dailyHoursDistribution,
} from './insights/balance.js'
