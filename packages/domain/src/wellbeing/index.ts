/**
 * Evening Companion / Wellbeing core (design v14 §H, ADR-0005) — the pure, exhaustively-tested
 * foundation that later feeds the grounded AI narration and the Today evening card. Two pieces:
 * `reviewDay` turns one day's already-computed signals into a banded load level + structured
 * facts (no prose), and `computeBaseline` calibrates a load-score history to the person's own
 * norm (the §H3 baseline principle) with deterministic trend + pattern flags. Never a diagnosis.
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
