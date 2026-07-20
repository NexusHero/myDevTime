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
// Reports/analytics CSV export (REQ-045, ADR-0005) — deterministic CSV of the dashboard view-model,
// distinct from the timesheet/invoice export (REQ-009).
export type {
  ReportExportInput,
  ReportExportProject,
  ReportExportBudget,
} from './reporting/export.js'
export { reportToCsv } from './reporting/export.js'
// AI standup / summary (REQ-014, ADR-0005) — the deterministic report with **protected numeric
// slots** the LLM narrates around but may never change; `renderStandupPlain` is the AI-free
// degradation, `slotsPreserved` verifies a draft kept every number (slot integrity).
export type { StandupLine, StandupInput, StandupReport } from './reporting/standup.js'
export {
  buildStandup,
  formatHm,
  standupSlots,
  slotsPreserved,
  renderStandupPlain,
  msToHours,
} from './reporting/standup.js'
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
// Plan-apply seam (ADR-0071 P4, REQ-070) — a *confirmed* Sevi block proposal (move/shrink)
// applied to the stored blocks purely; the service persists the result as a new plan version.
export type { PlanBlockMutation } from './planner/applyProposal.js'
export { applyProposal, blockIdOf, MIN_SHRUNK_BLOCK_MIN } from './planner/applyProposal.js'

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

// Grounded-assistant retrieval (REQ-020/flagship AI, ADR-0005) — IDF-weighted relevance ranking to
// ground the LLM on the *most relevant* of the caller's own facts, and `isOffData` for a clean
// off-data refusal that never even calls the model. Pure; the LLM only phrases the selected facts.
export type { ScoredFact, GroundingOptions } from './assistant/grounding.js'
export { tokenize, rankFacts, selectGroundingFacts, isOffData } from './assistant/grounding.js'

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

// Meeting-transcript core (REQ-025/026, ADR-0005/0009) — flattens consent-first ASR segments to
// text, extracts grounded facts (via the notes core), and proposes **action items as confirmed-only
// proposals** (`ai-proposal`, never a booked task). The ASR itself is a `TranscriptionPort` adapter.
export type {
  TranscriptSegment,
  ActionItemProposal,
  ActionItemOptions,
} from './meetings/transcript.js'
export { transcriptText, transcriptFacts, actionItemProposals } from './meetings/transcript.js'

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

// Photo/mail schedule import (REQ-064, design v17 §F6 KI5) — the deterministic half of "photograph
// a school timetable → ghost series to confirm". A vision model proposes lessons via a narrow port;
// `toSeriesProposals` validates them and shapes them into weekly `RecurrenceRule` series proposals
// with `ai-proposal` provenance. It never books — the AI extracts, the human confirms (ADR-0005).
export type { ExtractedLesson, SeriesProposal } from './photoimport/schedule.js'
export { toSeriesProposals } from './photoimport/schedule.js'

// Deterministic categorization rules engine (REQ-011, ADR-0005) — ordered, versioned matcher →
// action; the first matching rule wins, a dry-run previews without applying, and every application
// records `rule:<id>@<version>` provenance. Pure code, never an LLM — proposals only.
export type {
  RuleSubject,
  RuleMatcher,
  RuleAction,
  Rule,
  RuleMatch,
  DryRunRow,
} from './rules/engine.js'
export { matches, orderedRules, evaluate, dryRun, ruleProvenance } from './rules/engine.js'

// Task effort estimation (REQ-041, ADR-0005) — category + complexity → an hours **range** (no
// false precision); the user's own number wins with `user` provenance; `estimateVsActual` compares
// the chosen estimate to tracked reality. Pure; any AI review is assist-only, never mutating.
export type {
  TaskComplexity,
  TaskCategory,
  EstimateRange,
  EstimateProvenance,
  ResolvedEstimate,
  EstimateVsActual,
} from './estimating/effort.js'
export {
  baselineRange,
  rangeMidpoint,
  resolveEstimate,
  estimateVsActual,
} from './estimating/effort.js'

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

// Partner-light Free/Busy sharing (REQ-064, design v17 §F6) — one link, free to view,
// calendar + requests only. A viewer only ever receives `FreeBusySlot`, a type with no field
// that could carry a title/project/note, so private detail is unrepresentable, not merely
// filtered. `redactBlock` is the single choke point; a 🛡 protected block reads as plain busy.
export type { OwnerBlock, FreeBusySlot, Window } from './sharing/freebusy.js'
export { toFreeBusy, freeGaps } from './sharing/freebusy.js'

// Calendar-sync merge (REQ-064, design v17 §F6) — the deterministic diff behind the calendar
// port: external events (Google/Apple, via an adapter) vs already-imported blocks → new / changed
// / orphaned **proposals**, keyed on the event uid. It never writes: calendar events become ghost
// blocks to confirm, never auto-booked (ADR-0005). Vendor SDKs stay confined to the port adapter.
export type {
  ExternalEvent,
  ImportedBlock,
  MergeChange,
  MergeProposal,
} from './calendarsync/merge.js'
export { mergeCalendar } from './calendarsync/merge.js'

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
export type {
  TimedSpan,
  BookedSpan,
  RealityGap,
  RealityOptions,
  TimesheetDraft,
  TimesheetDraftResult,
} from './autotracker/reality.js'
export {
  trackedMs,
  realityDrift,
  detectUnbookedGap,
  timesheetDrafts,
} from './autotracker/reality.js'

// Shutdown / Feierabend ritual (REQ-063, design v17 §K5) — the deterministic day-close summary
// (booked / reality / unbooked remainder / open drafts / tomorrow-first); the day is "clean"
// when nothing is open. Pure (ADR-0005).
export type { ShutdownInput, ShutdownSummary } from './shutdown/summary.js'
export { shutdownSummary } from './shutdown/summary.js'

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

// Evening Companion / Wellbeing core (design v14 §H, ADR-0005) — the pure foundation for the
// grounded AI narration + Today evening card. `reviewDay` bands one day's already-computed
// signals into a four-valued load level + structured facts (no prose); `computeBaseline`
// calibrates a load-score history to the person's own norm (§H3) with trend + pattern flags.
// Never a diagnosis, never a fabricated number — the LLM narrates these facts, it never invents them.
export type {
  DayLoadLevel,
  SignalSeverity,
  DayReviewInput,
  DayReview,
  WellbeingSignal,
  WellbeingSignalKind,
  LongDaySignal,
  OvertimeSignal,
  BreakShortfallSignal,
  BackToBackMeetingsSignal,
  MeetingHeavySignal,
  PlanOverrunSignal,
  LowMoodSignal,
  BaselineDay,
  LoadTrend,
  WellbeingBaseline,
  PatternFlag,
  PatternFlagKind,
  ConsecutiveHeavyDaysFlag,
  WeekdayOverbookFlag,
} from './wellbeing/index.js'
export {
  reviewDay,
  LONG_DAY_MINUTES,
  COMFORTABLE_MEETINGS,
  MEETING_HEAVY_MINIMUM,
  BACK_TO_BACK_MINIMUM,
  PLAN_OVERRUN_MINIMUM,
  LOW_MOOD_MAXIMUM,
  LOAD_BAND_NORMAL,
  LOAD_BAND_HEAVY,
  LOAD_BAND_OVERLOAD,
  computeBaseline,
  MIN_BASELINE_DAYS,
  HEAVY_LOAD_SCORE,
  CONSECUTIVE_HEAVY_MINIMUM,
  MIN_WEEKDAY_SAMPLES,
  WEEKDAY_OVERBOOK_DELTA,
  TREND_DELTA,
} from './wellbeing/index.js'

// Sevi live-load + nudge policy (ADR-0071, REQ-067/069) — the deterministic care buddy core:
// `evaluateLiveLoad` bands the *running* day (universal ArbZG-grounded hard caps + the person's
// own baseline band) into calm/watch/speak-up with typed reasons, and `decideNudge` gates whether
// a speak-up may be voiced right now (opt-in, quiet hours incl. midnight wrap, 🛡 protected block,
// daily cap) — a held speak-up folds into ONE later digest (REQ-057). Whether Sevi speaks is
// 100 % these cores; the LLM only phrases (ADR-0005). The intraday `LoadLevel` is exported as
// `LiveLoadLevel` here — `insights/balance` already owns the plain name at this boundary.
export type {
  LoadLevel as LiveLoadLevel,
  LiveLoadReason,
  LiveLoadInput,
  LiveLoad,
  NudgeContext,
  NudgeDecision,
} from './wellbeing/index.js'
export {
  evaluateLiveLoad,
  liveLoadScore,
  NO_BREAK_CAP_MS,
  LONG_DAY_CAP_MS,
  WATCH_FOCUS_MS,
  WATCH_WORKED_MS,
  WATCH_BACK_TO_BACK,
  decideNudge,
  inQuietWindow,
} from './wellbeing/index.js'

// Consented mood memory (ADR-0071 P3, REQ-068) — the closed punch-out vocabulary
// (good/tense/stressed) and its fixed mapping onto `reviewDay`'s 1..5 `moodScore`, finally
// feeding the `low-mood` signal path. Stored only under explicit opt-in; never a diagnosis.
export type { Mood } from './wellbeing/index.js'
export { moodScoreOf, MOOD_WORDS } from './wellbeing/index.js'

// Sevi life care (ADR-0071 P5, REQ-071) — the deterministic core behind the calm life-care
// voices: `freeEveningsIn` counts evenings kept free of work (life/breaks never consume one),
// and `lifeCareSuggestions` derives no-free-evening / life-encroachment / rest-day, most urgent
// first. Whether a voice may actually be *delivered* stays `decideNudge`'s call (shared cap,
// quiet hours, 🛡) — this core only states what is true (ADR-0005).
export type {
  LifeCareSuggestion,
  LifeCareSuggestionKind,
  LifeCareInput,
  EveningBlock,
} from './wellbeing/index.js'
export {
  lifeCareSuggestions,
  freeEveningsIn,
  MIN_EVENING_WINDOW_DAYS,
  REST_DAY_THRESHOLD_DEFAULT,
  EVENING_START_MIN,
  EVENING_END_MIN,
} from './wellbeing/index.js'

// Issue/ticket import core (GitHub Issues + Azure DevOps Work Items → candidate tasks, ADR-0005) —
// adapters fetch tickets as neutral `ExternalIssue`s; `toTaskProposals` maps, filters closed,
// dedups (vs already-imported and in-batch) and deterministically orders them into
// `CandidateTaskProposal`s (`confirmed: false`, `import:<source>` provenance). It never creates —
// the import proposes candidate tasks, the human confirms (ADR-0005). Pure, framework-free.
export type {
  IssueSource,
  ExternalIssue,
  CandidateTaskProposal,
  ImportOptions,
} from './issueimport/index.js'
export { toTaskProposals } from './issueimport/index.js'
