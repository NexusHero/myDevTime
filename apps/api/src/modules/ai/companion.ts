import type { Provider } from '@nestjs/common'
import {
  computeBaseline,
  reviewDay,
  type DayReview,
  type DayReviewInput,
  type LoadTrend,
  type WellbeingBaseline,
  type WellbeingSignal,
} from '@mydevtime/domain'
import { LLM } from './llm/llm.provider.js'
import { LlmUnavailableError, type LlmPort } from './llm/port.js'

/**
 * The **Evening Companion** — a grounded, warm day-close narration (design v14 §H, ADR-0005). It
 * runs the deterministic wellbeing core first and always: `reviewDay` bands the day's already-computed
 * signals into a load level + structured facts, and `computeBaseline` calibrates the person's own
 * load history into a normal band, a trend and pattern flags. Those numbers are code's — free, never
 * fabricated. On top, an *optional* LLM weaves the fragmented care-signals into a single caring voice:
 * one warm evening paragraph plus one gentle forward suggestion. The LLM may name the signals, the
 * load level and the trend, but it must invent no numbers — the deterministic facts are the grounding
 * and they always win. When the provider is down, credits are out, or the reply is unusable, the
 * companion degrades to a deterministic template built from the very same signals and costs nothing.
 * Proposal-only: the suggestion is a proposal the user confirms (provenance `ai-proposal`); nothing is
 * booked, no plan is touched, no state is mutated here (ADR-0005).
 */

/** The raw day signals as they arrive from the validated DTO (mood may be `undefined`). */
export interface CompanionDayInput {
  readonly plannedMinutes: number
  readonly actualMinutes: number
  readonly overtimeMinutes: number
  readonly breakShortfallMinutes: number
  readonly meetingCount: number
  readonly backToBackMeetingCount: number
  readonly moodScore?: 1 | 2 | 3 | 4 | 5 | undefined
  readonly planDriftMinutes: number
  readonly isAbsenceDay: boolean
}

/** One past day for the baseline (its load score + the weekday it fell on). */
export interface CompanionHistoryDay {
  readonly loadScore: number
  readonly weekday: number
}

/** The gentle forward suggestion's kind — deterministically chosen from the day's signals. */
export type CompanionSuggestionKind =
  | 'protect-morning'
  | 'space-meetings'
  | 'take-breaks'
  | 'right-size-plan'
  | 'gentle-tomorrow'
  | 'keep-balance'
  | 'rest-day'

export interface CompanionMessage {
  readonly source: 'deterministic' | 'ai-proposal'
  readonly text: string
}

export interface CompanionSuggestion {
  readonly kind: CompanionSuggestionKind
  readonly text: string
  /** A proposal the user confirms — nothing is booked or planned on its own (ADR-0005). */
  readonly provenance: 'ai-proposal'
}

export interface CompanionResult {
  readonly review: DayReview
  readonly baseline: WellbeingBaseline
  readonly message: CompanionMessage
  readonly suggestion?: CompanionSuggestion
}

export interface CompanionOptions {
  readonly allowAi: boolean
}

const MAX_OUTPUT_TOKENS = 320

/** Bridge the loose DTO day to a domain `DayReviewInput`; `moodScore` is only set when present. */
function toDayReviewInput(day: CompanionDayInput): DayReviewInput {
  const base = {
    plannedMinutes: day.plannedMinutes,
    actualMinutes: day.actualMinutes,
    overtimeMinutes: day.overtimeMinutes,
    breakShortfallMinutes: day.breakShortfallMinutes,
    meetingCount: day.meetingCount,
    backToBackMeetingCount: day.backToBackMeetingCount,
    planDriftMinutes: day.planDriftMinutes,
    isAbsenceDay: day.isAbsenceDay,
  }
  return day.moodScore !== undefined ? { ...base, moodScore: day.moodScore } : base
}

/** One signal as a short, human line. Every number is the signal's own (code's), never invented. */
function signalLine(signal: WellbeingSignal): string {
  switch (signal.kind) {
    case 'long-day':
      return `a long day — ${String(signal.detail.minutesOver)} min past a nine-hour day`
    case 'overtime':
      return `${String(signal.detail.overtimeMinutes)} min of overtime`
    case 'break-shortfall':
      return `${String(signal.detail.shortfallMinutes)} min of breaks that slipped by`
    case 'back-to-back-meetings':
      return `${String(signal.detail.count)} meetings back-to-back`
    case 'meeting-heavy':
      return `${String(signal.detail.count)} meetings filling the day`
    case 'plan-overrun':
      return `about ${String(signal.detail.minutesOver)} min over today's plan`
    case 'low-mood':
      return `you flagged the day as a tough one`
  }
}

/** A warm sentence about where the week sits — the person's own trend, no numbers. */
function trendSentence(trend: LoadTrend): string {
  if (trend === 'rising') return 'Your week has been building, so keep an eye on the load.'
  if (trend === 'falling') return "And the week has been easing off — that's good to see."
  return 'The week has held pretty steady.'
}

/**
 * The deterministic, still-caring narration — built entirely from the day's own signals, load level
 * and trend. This is the honest free fallback when the LLM is unavailable, and the grounding the LLM
 * warms up when it is. No number here is invented: each comes from `reviewDay`/`computeBaseline`.
 */
function deterministicNarration(
  review: DayReview,
  baseline: WellbeingBaseline,
  day: CompanionDayInput,
): string {
  if (day.isAbsenceDay) {
    return 'A day away from work — rest is part of the work too. Nothing to tally today; see you tomorrow.'
  }
  if (review.signals.length === 0) {
    return `A steady day — nothing pulled too hard on you. ${trendSentence(baseline.trend)} Nice work closing it out.`
  }
  const opener =
    review.loadLevel === 'overload'
      ? 'That was a heavy one.'
      : review.loadLevel === 'heavy'
        ? 'A full day, that.'
        : 'A busy day, but a manageable one.'
  const lines = review.signals.slice(0, 3).map(signalLine)
  const joined =
    lines.length === 1
      ? (lines[0] ?? '')
      : `${lines.slice(0, -1).join(', ')} and ${lines[lines.length - 1] ?? ''}`
  return `${opener} There was ${joined}. ${trendSentence(baseline.trend)} You showed up for it — now let it go for the evening.`
}

/** The deterministic forward suggestion — its kind and a caring default phrasing, from the signals. */
function suggestionFor(review: DayReview, day: CompanionDayInput): CompanionSuggestion {
  const kinds = new Set(review.signals.map(s => s.kind))
  const pick = (kind: CompanionSuggestionKind, text: string): CompanionSuggestion => ({
    kind,
    text,
    provenance: 'ai-proposal',
  })
  if (day.isAbsenceDay) return pick('rest-day', 'Enjoy the day off — there is nothing to plan.')
  if (review.loadLevel === 'overload' || kinds.has('long-day') || kinds.has('overtime')) {
    return pick(
      'protect-morning',
      'Protect tomorrow morning for focus — block the first stretch before any meetings land.',
    )
  }
  if (kinds.has('break-shortfall')) {
    return pick('take-breaks', 'Put a couple of real breaks on tomorrow so they actually hold.')
  }
  if (kinds.has('back-to-back-meetings') || kinds.has('meeting-heavy')) {
    return pick(
      'space-meetings',
      'Leave a little gap between tomorrow’s meetings so you can breathe.',
    )
  }
  if (kinds.has('plan-overrun')) {
    return pick(
      'right-size-plan',
      "Right-size tomorrow's plan so it fits the day you actually have.",
    )
  }
  if (kinds.has('low-mood')) {
    return pick(
      'gentle-tomorrow',
      'Go gentle tomorrow — a lighter first block can help things reset.',
    )
  }
  return pick('keep-balance', 'A balanced day — keep doing what is working for you.')
}

/** Build the grounded prompt: the deterministic facts are the only ground truth the model may name. */
function buildPrompt(
  review: DayReview,
  baseline: WellbeingBaseline,
  suggestion: CompanionSuggestion,
): string {
  const facts: string[] = [`Load level: ${review.loadLevel}`, `Week trend: ${baseline.trend}`]
  for (const line of review.signals.map(signalLine)) facts.push(`Signal: ${line}`)
  for (const flag of baseline.patternFlags) {
    facts.push(
      flag.kind === 'consecutive-heavy-days'
        ? `Pattern: ${String(flag.detail.runLength)} heavy days in a row`
        : `Pattern: one weekday runs heavier than the rest`,
    )
  }
  if (review.signals.length === 0) facts.push('Signal: nothing pulled hard today')
  return [
    'You are a warm, grounded evening companion inside a time-tracking app. In one short paragraph',
    '(second person, gentle, never clinical, never a diagnosis) reflect back the person’s day and',
    'help them let it go for the evening. Then give ONE gentle forward suggestion for tomorrow in the',
    'spirit of this idea: "' + suggestion.text + '".',
    'These grounding rules override everything: speak ONLY from the facts below, and invent NO numbers',
    'or events that are not in them. You may name the load level, the trend and the signals in your own',
    'warm words. Answer in English.',
    'Return STRICT JSON only, no prose around it: {"narration": "...", "suggestion": "..."}',
    '',
    'FACTS:',
    ...facts,
  ].join('\n')
}

/** Parse the model’s JSON reply; returns null when it is unusable so the caller can degrade. */
function parseReply(raw: string): { narration: string; suggestion: string } | null {
  const text = raw.trim()
  if (text.length === 0) return null
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object') return null
  const record = parsed as Record<string, unknown>
  const narration = typeof record.narration === 'string' ? record.narration.trim() : ''
  if (narration.length === 0) return null
  const suggestion = typeof record.suggestion === 'string' ? record.suggestion.trim() : ''
  return { narration, suggestion }
}

export interface CompanionService {
  compose(
    day: CompanionDayInput,
    history: readonly CompanionHistoryDay[],
    opts: CompanionOptions,
  ): Promise<CompanionResult>
}

export const COMPANION = Symbol('COMPANION')

/** The LLM-backed evening companion. Never throws on the AI path — it degrades to the free template. */
export class LlmCompanion implements CompanionService {
  constructor(private readonly llm: LlmPort) {}

  async compose(
    day: CompanionDayInput,
    history: readonly CompanionHistoryDay[],
    opts: CompanionOptions,
  ): Promise<CompanionResult> {
    // The deterministic core runs first and always — free, and the single source of every number.
    const review = reviewDay(toDayReviewInput(day))
    const baseline = computeBaseline(history)
    const deterministicSuggestion = suggestionFor(review, day)

    const degraded = (): CompanionResult => ({
      review,
      baseline,
      message: { source: 'deterministic', text: deterministicNarration(review, baseline, day) },
      suggestion: deterministicSuggestion,
    })

    // A day off carries no work load and no signals — a warm free rest note says everything; a model
    // call would add nothing (and should never be billed).
    if (!opts.allowAi || day.isAbsenceDay) return degraded()

    const available = await this.llm.available().catch(() => false)
    if (!available) return degraded()

    try {
      const result = await this.llm.complete({
        messages: [
          { role: 'user', content: buildPrompt(review, baseline, deterministicSuggestion) },
        ],
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.5,
      })
      const parsed = parseReply(result.text)
      if (parsed === null) return degraded()
      // The suggestion KIND stays deterministic (grounding); only its phrasing may be the model’s.
      const suggestion: CompanionSuggestion = {
        kind: deterministicSuggestion.kind,
        text: parsed.suggestion.length > 0 ? parsed.suggestion : deterministicSuggestion.text,
        provenance: 'ai-proposal',
      }
      return {
        review,
        baseline,
        message: { source: 'ai-proposal', text: parsed.narration },
        suggestion,
      }
    } catch (error) {
      if (error instanceof LlmUnavailableError) return degraded()
      return degraded() // the proposal layer never fails the request (ADR-0005)
    }
  }
}

/** Binds the `COMPANION` port to the LLM-backed evening companion. */
export const companionProvider: Provider = {
  provide: COMPANION,
  inject: [LLM],
  useFactory: (llm: LlmPort): CompanionService => new LlmCompanion(llm),
}
