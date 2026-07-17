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

// Monthly work-time statement (REQ-052, ADR-0065 · design v13 X) — the "real punch
// clock": begin/pause/end per day, ± against target, a cumulative balance from carryover
// to closing, absence rows, and an audit note. Renders the signable monthly PDF.
export type {
  StatementDay,
  MonthlyStatement,
  MonthlyStatementInput,
} from './attendance/statement.js'
export { buildMonthlyStatement } from './attendance/statement.js'
export type { BookedInterval, CoverageReport } from './attendance/coverage.js'
export { reconcileCoverage } from './attendance/coverage.js'
export type { HolidayRegion } from './absences/holidays.js'
export { easterSunday, holidaysForRegion, HOLIDAY_REGIONS } from './absences/holidays.js'
export type { PlanLabel } from './planner/label.js'
export { deterministicLabels } from './planner/label.js'

// Contextual-banner resolver (REQ-059, design v14 §M2) — the Planner shows at most ONE banner;
// a fixed priority (Conflict > Price > Healing > Note) picks it and the rest wait. One
// `ContextBanner` variant model, one deterministic picker (ADR-0005).
export type { BannerVariant, ContextBanner } from './planner/banner.js'
export { BANNER_PRIORITY, pickBanner } from './planner/banner.js'

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

// Smart-Add typed-entry parser (REQ-047, ADR-0065) — Stage 1 of the one-plus/one-field
// quick-add (design v13, K6). Classifies a phrase into a typed draft (task/meeting/
// absence/travel/private) with times, day, and project/ticket hints; a weak parse asks
// for the grounded LLM Stage-2 fallback (`needsAi`). Pure, de/en, ADR-0005.
export type { SmartEntryKind, SmartEntryDraft, SmartParseOptions } from './smartadd/parse.js'
export { parseEntry } from './smartadd/parse.js'

// Economics read models (REQ-048/049/050, ADR-0065 · design v13 G1–G3) — pure decision
// support: effective-rate truth (revenue ÷ all tracked hours), overtime compound
// (running balance + linear forecast), and Price of the week (intensity solver). All
// rule-based (ADR-0005); the AI never places a block or prices an hour.
export type { EffectiveRate } from './economics/effective-rate.js'
export { effectiveRate, perHourRate } from './economics/effective-rate.js'

// Plan-vs-realized revenue (REQ-061, design v17 §K4) — the deterministic "Plan ±x%" chip for
// fixed-fee projects: calculated plan vs realized, signed delta + rounded variance, over/on/under
// within a tolerance. Pure (ADR-0005); AI-free, no forecast.
export type { VarianceStatus, PlanVariance } from './economics/plan-variance.js'
export { planVsRealized } from './economics/plan-variance.js'
export type {
  OvertimeWeek,
  OvertimePoint,
  OvertimeTrend,
  OvertimeForecast,
  OvertimeForecastOptions,
} from './economics/overtime-forecast.js'
export { overtimeForecast } from './economics/overtime-forecast.js'
export type { WeekIntensity, WeekLoadInput, WeekPrice } from './economics/week-price.js'
export {
  WEEK_INTENSITIES,
  priceWeek,
  priceWeekAt,
  weekLoadFromMinutes,
} from './economics/week-price.js'

// Capacity honesty (REQ-055, design v14 §F Stufe 2) — one person, one timeline: the week
// you can truly work is the contracted target minus your own life/protected commitments
// ("KW32 nur 24h"). Fill-week, overbooking and the quote calculator plan against this.
export type {
  CommitmentKind,
  Commitment,
  CapacityDay,
  DayCapacity,
  WeekCapacity,
} from './capacity/plannable.js'
export { committedMinutes, dayCapacity, weekCapacity, overbookedMs } from './capacity/plannable.js'

// Travel entry type (REQ-051, ADR-0065 · design v13 G4) — deterministic travel pricing
// (reduced-fraction time + per-km allowance, train = full worktime) plus the G4b
// proposal helpers (return-trip nudge, magnetic chaining, commute favourites). Pure,
// location used only at start/stop (ADR-0058/0059 privacy).
export type {
  TravelMode,
  TravelLeg,
  TravelRatePolicy,
  TravelCost,
  TravelLegProposal,
  RouteFrequency,
} from './travel/travel.js'
export {
  effectiveFraction,
  priceTravel,
  returnTrip,
  nextLegStart,
  frequentRoutes,
} from './travel/travel.js'

// Quote-from-history estimator (REQ-053, ADR-0065 · design v13 KI2) — the deterministic
// half of the AI quote calculator: the honest distribution of how long similar past work
// took, plus a buffered suggestion. The AI only phrases it (ADR-0005/0029).
export type { QuoteEstimate, QuoteOptions } from './estimating/quote.js'
export { estimateFromHistory } from './estimating/quote.js'

// Meeting-notes core (REQ-054, ADR-0065 · design v13 KI4) — turns the user's own typed
// meeting notes into ordered, deduped fact lines (action-like first) that the grounded LLM
// phrases into follow-up actions. Pure, consent-first; ASR auto-capture (ADR-0009) is a
// future adapter feeding the same function.
export type { MeetingNotesOptions } from './meetings/notes.js'
export { meetingNotesFacts, looksLikeAction } from './meetings/notes.js'

// Recurring entries (REQ-060, design v17 §F4) — a core feature for every entry type. A rule
// (none/daily-weekdays/weekly/monthly + end never/until/count) expands to occurrence dates over
// a window; editing "this vs the series from here" splits it the Outlook way. Pure (ADR-0005).
export type { RecurrenceFreq, RecurrenceEnd, RecurrenceRule } from './recurrence/recur.js'
export {
  expandRecurrence,
  isOccurrence,
  truncateBefore,
  describeRecurrence,
} from './recurrence/recur.js'

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

// Role & tier visibility (REQ-056, design v14 §R) — role is a visibility *preset* over the
// existing modules, never a fork. Enforces the hard tier floors: a Stempler (Free) never sees
// €/clients/billing; Health is visible in every tier and never paywalled; Family is an
// orthogonal add-on. Pure (ADR-0005); distinct from the `can()` payment gate.
export type { UserRole, VisibilityModule, VisibilityContext } from './roles/visibility.js'
export { ALL_MODULES, isModuleVisible, visibleModules } from './roles/visibility.js'

// Protection flag "🛡 Geschützt" (REQ-057, design v14 D14) — a flag on existing entries that
// governs communication only, never time-tracking: nudges/requests are held during a protected
// block and surface as exactly one digest afterwards; the Island prompts once at a protected
// start while punched in and never auto-punches-out. Pure (ADR-0005), no time-tracking math.
export type {
  HeldKind,
  HeldItem,
  ProtectedBlock,
  ProtectionDigest,
} from './protection/protection.js'
export {
  isProtectedAt,
  partitionByProtection,
  buildDigest,
  transitionPromptDue,
} from './protection/protection.js'

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

// Health & Balance core (REQ-058, design v14 §H) — the binding baseline principle (health
// signals calibrate to the person's own >4-week norm, never a fixed threshold) plus the
// honest Balance row (Work / Protected / Free over waking hours). Pure, never a diagnosis.
export type {
  Baseline,
  BaselineBand,
  BaselineComparison,
  BaselineOptions,
  BalanceInput,
  BalanceRow,
} from './insights/health.js'
export {
  MIN_BASELINE_PERIODS,
  personalBaseline,
  compareToBaseline,
  balanceRow,
} from './insights/health.js'
