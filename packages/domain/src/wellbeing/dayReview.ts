/**
 * Evening Companion / Wellbeing — day review core (design v14 §H "Health & Balance",
 * ADR-0005). Pure and deterministic: it turns a day's *already-computed* signals into a
 * banded load level plus a set of small, human-meaningful **structured facts**. It emits
 * no prose — the grounded LLM narrates around these facts later, and the Today evening card
 * renders them, but every number here is code's (ADR-0005), never fabricated by the model.
 *
 * This extends the existing wellbeing vocabulary rather than reinventing it: it reuses the
 * neutral **load** idea from `insights/balance` (a workload metric, never a diagnosis — the
 * "Balance-Feature-Ethik" rule) and the plan-drift idea from `planner` (tracked − planned).
 * The load *scale* here is four-valued (light/normal/heavy/overload) and day-scoped, distinct
 * from `insights/balance`'s three-valued window level, so the types are named to not collide.
 *
 * No clock, no I/O, no framework: any "today"/weekday context is passed in as data. A signal
 * that cannot be computed from the input is simply **absent**, never guessed — an honest gap,
 * not a zero.
 */

/** The day-load band, lightest→heaviest. Four-valued and day-scoped (cf. `insights/balance`). */
export type DayLoadLevel = 'light' | 'normal' | 'heavy' | 'overload'

/** How pronounced a single signal is. Ordinal, not a judgement of the person. */
export type SignalSeverity = 'low' | 'medium' | 'high'

/** The day's real, already-computed signals — this core fetches nothing. */
export interface DayReviewInput {
  /** Focus minutes the plan intended for the day (0 when there was no plan). */
  readonly plannedMinutes: number
  /** Minutes actually tracked/worked on the day. */
  readonly actualMinutes: number
  /** Overtime minutes beyond target for the day (0 when none / not applicable). */
  readonly overtimeMinutes: number
  /** Minutes of legally/ergonomically required break that were *missed* (0 when none). */
  readonly breakShortfallMinutes: number
  /** How many meetings the day held. */
  readonly meetingCount: number
  /** How many of those meetings ran back-to-back with the previous one (no gap). */
  readonly backToBackMeetingCount: number
  /** Optional self-reported mood, 1 (low) … 5 (high). Absent when the user didn't log it. */
  readonly moodScore?: 1 | 2 | 3 | 4 | 5
  /** Signed drift of actual vs plan (`actual − planned`); positive means over the plan. */
  readonly planDriftMinutes: number
  /** A full absence day (vacation/sick/holiday): no work load, no work signals. */
  readonly isAbsenceDay: boolean
}

export interface LongDaySignal {
  readonly kind: 'long-day'
  readonly severity: SignalSeverity
  readonly detail: { readonly minutesOver: number }
}
export interface OvertimeSignal {
  readonly kind: 'overtime'
  readonly severity: SignalSeverity
  readonly detail: { readonly overtimeMinutes: number }
}
export interface BreakShortfallSignal {
  readonly kind: 'break-shortfall'
  readonly severity: SignalSeverity
  readonly detail: { readonly shortfallMinutes: number }
}
export interface BackToBackMeetingsSignal {
  readonly kind: 'back-to-back-meetings'
  readonly severity: SignalSeverity
  readonly detail: { readonly count: number }
}
export interface MeetingHeavySignal {
  readonly kind: 'meeting-heavy'
  readonly severity: SignalSeverity
  readonly detail: { readonly count: number }
}
export interface PlanOverrunSignal {
  readonly kind: 'plan-overrun'
  readonly severity: SignalSeverity
  readonly detail: { readonly minutesOver: number }
}
export interface LowMoodSignal {
  readonly kind: 'low-mood'
  readonly severity: SignalSeverity
  readonly detail: { readonly moodScore: number }
}

/** One typed, human-meaningful fact about the day. The LLM narrates these; it never invents them. */
export type WellbeingSignal =
  | LongDaySignal
  | OvertimeSignal
  | BreakShortfallSignal
  | BackToBackMeetingsSignal
  | MeetingHeavySignal
  | PlanOverrunSignal
  | LowMoodSignal

/** The closed set of signal kinds — the contract the AI narration + Today card wire against. */
export type WellbeingSignalKind = WellbeingSignal['kind']

export interface DayReview {
  readonly loadLevel: DayLoadLevel
  /** The composite load score (see weights below), rounded to one decimal. */
  readonly loadScore: number
  /** The day's structured facts, in a stable kind order. Empty on an absence day. */
  readonly signals: readonly WellbeingSignal[]
}

// ─── Documented thresholds ────────────────────────────────────────────────────────────────
// A "standard" work day is 8 h (480 min); load accrues past that. All thresholds are minutes
// unless noted. They are the single source of truth for both the score and the signal firing.

/** A day is a "long day" (signal) once tracked minutes pass this (9 h). */
export const LONG_DAY_MINUTES = 540
/** Load accrues past a standard 8 h day, at 1 point per hour over. */
const STANDARD_DAY_MINUTES = 480
/** Meetings are comfortable up to this many; each extra one adds load. */
export const COMFORTABLE_MEETINGS = 4
/** The `meeting-heavy` signal fires at this many meetings. */
export const MEETING_HEAVY_MINIMUM = 5
/** The `back-to-back-meetings` signal fires at this many back-to-back meetings. */
export const BACK_TO_BACK_MINIMUM = 2
/** The `plan-overrun` signal fires once actual runs this many minutes over plan (1 h). */
export const PLAN_OVERRUN_MINIMUM = 60
/** Mood at or below this (out of 5) fires the `low-mood` signal. */
export const LOW_MOOD_MAXIMUM = 2

/** Load-score band edges: light `[0,2)`, normal `[2,5)`, heavy `[5,8)`, overload `[8,∞)`. */
export const LOAD_BAND_NORMAL = 2
export const LOAD_BAND_HEAVY = 5
export const LOAD_BAND_OVERLOAD = 8

/** Map a magnitude to a severity given its medium/high cut points. */
function severityFor(value: number, mediumAt: number, highAt: number): SignalSeverity {
  if (value >= highAt) return 'high'
  if (value >= mediumAt) return 'medium'
  return 'low'
}

/** Band a composite load score into the four-valued day-load level. */
function bandLoad(score: number): DayLoadLevel {
  if (score >= LOAD_BAND_OVERLOAD) return 'overload'
  if (score >= LOAD_BAND_HEAVY) return 'heavy'
  if (score >= LOAD_BAND_NORMAL) return 'normal'
  return 'light'
}

/**
 * The composite load score — a documented weighted sum of the day's pressures, so the band is
 * reproducible and testable. Weights (each term is `max(0, …)`):
 *   • long day:      hours tracked past a standard 8 h day   → 1.0 / hour
 *   • overtime:      overtime minutes                        → 1.0 / 30 min
 *   • break debt:    missed break minutes                    → 1.0 / 15 min
 *   • meetings:      meetings past the comfortable count      → 0.5 / meeting
 *   • back-to-back:  back-to-back meetings                    → 1.0 / meeting
 *   • plan overrun:  minutes worked over plan                 → 1.0 / 30 min
 *   • low mood:      mood 1 → 2.0, mood 2 → 1.0, else 0
 * Rounded to one decimal for a stable value.
 */
function loadScoreFor(input: DayReviewInput): number {
  const longDay = Math.max(0, input.actualMinutes - STANDARD_DAY_MINUTES) / 60
  const overtime = Math.max(0, input.overtimeMinutes) / 30
  const breakDebt = Math.max(0, input.breakShortfallMinutes) / 15
  const meetings = Math.max(0, input.meetingCount - COMFORTABLE_MEETINGS) * 0.5
  const backToBack = Math.max(0, input.backToBackMeetingCount) * 1
  const planOverrun = Math.max(0, input.planDriftMinutes) / 30
  const mood = input.moodScore === 1 ? 2 : input.moodScore === 2 ? 1 : 0
  const raw = longDay + overtime + breakDebt + meetings + backToBack + planOverrun + mood
  return Math.round(raw * 10) / 10
}

/** Collect the day's structured facts, in a stable kind order (never prose). */
function signalsFor(input: DayReviewInput): WellbeingSignal[] {
  const signals: WellbeingSignal[] = []

  if (input.actualMinutes > LONG_DAY_MINUTES) {
    const minutesOver = input.actualMinutes - LONG_DAY_MINUTES
    signals.push({
      kind: 'long-day',
      severity: severityFor(minutesOver, 60, 180),
      detail: { minutesOver },
    })
  }

  if (input.overtimeMinutes > 0) {
    signals.push({
      kind: 'overtime',
      severity: severityFor(input.overtimeMinutes, 60, 120),
      detail: { overtimeMinutes: input.overtimeMinutes },
    })
  }

  if (input.breakShortfallMinutes > 0) {
    signals.push({
      kind: 'break-shortfall',
      severity: severityFor(input.breakShortfallMinutes, 15, 30),
      detail: { shortfallMinutes: input.breakShortfallMinutes },
    })
  }

  if (input.backToBackMeetingCount >= BACK_TO_BACK_MINIMUM) {
    signals.push({
      kind: 'back-to-back-meetings',
      severity: severityFor(input.backToBackMeetingCount, BACK_TO_BACK_MINIMUM, 4),
      detail: { count: input.backToBackMeetingCount },
    })
  }

  if (input.meetingCount >= MEETING_HEAVY_MINIMUM) {
    signals.push({
      kind: 'meeting-heavy',
      severity: severityFor(input.meetingCount, MEETING_HEAVY_MINIMUM, 8),
      detail: { count: input.meetingCount },
    })
  }

  if (input.planDriftMinutes > PLAN_OVERRUN_MINIMUM) {
    const minutesOver = input.planDriftMinutes
    signals.push({
      kind: 'plan-overrun',
      severity: severityFor(minutesOver, 120, 180),
      detail: { minutesOver },
    })
  }

  if (input.moodScore !== undefined && input.moodScore <= LOW_MOOD_MAXIMUM) {
    signals.push({
      kind: 'low-mood',
      severity: input.moodScore <= 1 ? 'high' : 'medium',
      detail: { moodScore: input.moodScore },
    })
  }

  return signals
}

/**
 * Review one day into a banded load level and its structured facts. An absence day carries no
 * work load and no work signals — it reads as `light` with an empty score and no facts, by
 * design (a day off is not a light work day, it is *no* work day). A zero/empty ordinary day is
 * likewise `light` and never crashes. No prose is produced; the LLM narrates these facts later.
 */
export function reviewDay(input: DayReviewInput): DayReview {
  if (input.isAbsenceDay) {
    return { loadLevel: 'light', loadScore: 0, signals: [] }
  }
  const loadScore = loadScoreFor(input)
  return { loadLevel: bandLoad(loadScore), loadScore, signals: signalsFor(input) }
}
