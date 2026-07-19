import { postJson } from './http.js'
import { z } from 'zod'

/**
 * The Evening Companion client (design v14 §H · ADR-0005/0029). The client hands the day's own
 * already-computed signals (planned/actual/overtime/break-shortfall/meetings/mood/plan-drift/absence)
 * plus a short recent load-score history to the server, which runs the deterministic wellbeing core
 * (`reviewDay` + `computeBaseline`) — free, and the source of every number — and, when affordable,
 * lets the LLM weave those grounded facts into one warm evening paragraph and a gentle forward
 * suggestion. `message.source` carries the provenance the UI must show: `ai-proposal` means the LLM
 * narrated and a credit was spent (`charged: true`); `deterministic` is the honest, free degradation
 * (provider down / no credits / absence day) where the message is a still-caring template built from
 * the same signals. The suggestion is a proposal the user confirms — nothing is booked or planned.
 * Every field the API omits or garbles is defaulted here so the UI never sees `undefined`.
 */
export const companionLoadLevelSchema = z
  .enum(['light', 'normal', 'heavy', 'overload'])
  .catch('light')
export type CompanionLoadLevel = z.infer<typeof companionLoadLevelSchema>

export const companionTrendSchema = z.enum(['rising', 'steady', 'falling']).catch('steady')
export type CompanionTrend = z.infer<typeof companionTrendSchema>

export const companionSeveritySchema = z.enum(['low', 'medium', 'high']).catch('low')

/** One structured wellbeing fact — its numbers are the server's deterministic core, never invented. */
export const companionSignalSchema = z.object({
  kind: z.string(),
  severity: companionSeveritySchema,
  detail: z.record(z.string(), z.number()).catch({}),
})
export type CompanionSignal = z.infer<typeof companionSignalSchema>

export const companionPatternFlagSchema = z.object({
  kind: z.string(),
  detail: z.record(z.string(), z.number()).catch({}),
})

export const companionReviewSchema = z.object({
  loadLevel: companionLoadLevelSchema,
  loadScore: z.number().catch(0),
  signals: z.array(companionSignalSchema).catch([]),
})
export type CompanionReview = z.infer<typeof companionReviewSchema>

export const companionBaselineSchema = z.object({
  // A short history serialises `+Infinity` as JSON `null` — treat either as "no upper bound".
  normalLow: z.number().catch(0),
  normalHigh: z.number().nullable().catch(null),
  trend: companionTrendSchema,
  patternFlags: z.array(companionPatternFlagSchema).catch([]),
})
export type CompanionBaseline = z.infer<typeof companionBaselineSchema>

export const companionMessageSchema = z.object({
  source: z.enum(['deterministic', 'ai-proposal']).catch('deterministic'),
  text: z.string().catch(''),
  charged: z.boolean().catch(false),
})
export type CompanionMessage = z.infer<typeof companionMessageSchema>

export const companionSuggestionSchema = z.object({
  kind: z.string(),
  text: z.string().catch(''),
  provenance: z.literal('ai-proposal').catch('ai-proposal'),
})
export type CompanionSuggestion = z.infer<typeof companionSuggestionSchema>

export const eveningCompanionSchema = z.object({
  review: companionReviewSchema.catch({ loadLevel: 'light', loadScore: 0, signals: [] }),
  baseline: companionBaselineSchema.catch({
    normalLow: 0,
    normalHigh: null,
    trend: 'steady',
    patternFlags: [],
  }),
  message: companionMessageSchema.catch({ source: 'deterministic', text: '', charged: false }),
  suggestion: companionSuggestionSchema.optional(),
})
export type EveningCompanion = z.infer<typeof eveningCompanionSchema>

/** The day's raw signals — where a signal isn't available, the caller omits it honestly (passes 0). */
export interface CompanionDayInput {
  readonly plannedMinutes: number
  readonly actualMinutes: number
  readonly overtimeMinutes: number
  readonly breakShortfallMinutes: number
  readonly meetingCount: number
  readonly backToBackMeetingCount: number
  readonly moodScore?: 1 | 2 | 3 | 4 | 5
  readonly planDriftMinutes: number
  readonly isAbsenceDay: boolean
}

/** One past day for the baseline (its load score + the weekday it fell on). */
export interface CompanionHistoryDay {
  readonly loadScore: number
  readonly weekday: number
}

/** The evening-companion request: the day's signals plus an optional recent load history. */
export interface EveningCompanionInput {
  readonly day: CompanionDayInput
  readonly history?: readonly CompanionHistoryDay[]
}

export function parseEveningCompanion(value: unknown): EveningCompanion {
  return eveningCompanionSchema.parse(value)
}

/**
 * Ask for the evening companion (read-only — the server writes and plans nothing, ADR-0005). The
 * review + baseline are deterministic and free; only the AI narration costs a credit, and a down
 * provider degrades to a free, still-caring deterministic message.
 */
export async function requestEveningCompanion(
  baseUrl: string,
  input: EveningCompanionInput,
  fetchImpl: typeof fetch = fetch,
): Promise<EveningCompanion> {
  return parseEveningCompanion(
    await postJson(baseUrl, '/api/ai/evening-companion', input, fetchImpl),
  )
}
