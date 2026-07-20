/**
 * Evening Companion / Wellbeing core (design v14 §H, ADR-0005) — the pure, exhaustively-tested
 * foundation that later feeds the grounded AI narration and the Today evening card. Four pieces:
 * `reviewDay` turns one day's already-computed signals into a banded load level + structured
 * facts (no prose), `computeBaseline` calibrates a load-score history to the person's own
 * norm (the §H3 baseline principle) with deterministic trend + pattern flags, and — for Sevi
 * (ADR-0071) — `evaluateLiveLoad` bands the *running* day intraday while `decideNudge` gates
 * whether a speak-up may actually be voiced (opt-in, quiet hours, 🛡, daily cap). Never a
 * diagnosis.
 */
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
} from './dayReview.js'
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
} from './dayReview.js'

export type { LoadLevel, LiveLoadReason, LiveLoadInput, LiveLoad } from './liveLoad.js'
export {
  evaluateLiveLoad,
  liveLoadScore,
  NO_BREAK_CAP_MS,
  LONG_DAY_CAP_MS,
  WATCH_FOCUS_MS,
  WATCH_WORKED_MS,
  WATCH_BACK_TO_BACK,
} from './liveLoad.js'

export type { NudgeContext, NudgeDecision } from './nudgePolicy.js'
export { decideNudge, inQuietWindow } from './nudgePolicy.js'

export type {
  BaselineDay,
  LoadTrend,
  WellbeingBaseline,
  PatternFlag,
  PatternFlagKind,
  ConsecutiveHeavyDaysFlag,
  WeekdayOverbookFlag,
} from './baseline.js'
export {
  computeBaseline,
  MIN_BASELINE_DAYS,
  HEAVY_LOAD_SCORE,
  CONSECUTIVE_HEAVY_MINIMUM,
  MIN_WEEKDAY_SAMPLES,
  WEEKDAY_OVERBOOK_DELTA,
  TREND_DELTA,
} from './baseline.js'
