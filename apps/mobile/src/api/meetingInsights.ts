import { postJson } from './http.js'
import { z } from 'zod'

/**
 * The AI meeting-insights client (REQ-026, #33 · ADR-0005/0029). The client posts a transcript it
 * captured with consent (REQ-025) — live audio capture is spike-gated on #31/#32, so today the only
 * transcript source is whatever the screen already holds. The server extracts grounded facts and
 * **confirmed-only** `ai-proposal` action items deterministically (free — never auto-created; a task
 * is created only when the user confirms one elsewhere), and may add an optional AI summary grounded
 * in the transcript. `summary.source` carries the provenance the UI must show: `ai-proposal` means
 * the LLM wrote it and a credit was debited (`charged: true`); `deterministic` is the honest, free
 * degradation (provider down / no credits) where the summary is the grounded fact lines. Nothing is
 * written to a timesheet/task. Every field the API omits or garbles is defaulted here so the UI never
 * sees `undefined`.
 */
export const meetingSummarySourceSchema = z
  .enum(['deterministic', 'ai-proposal'])
  .catch('deterministic')
export type MeetingSummarySource = z.infer<typeof meetingSummarySourceSchema>

export const meetingSummarySchema = z.object({
  source: meetingSummarySourceSchema,
  text: z.string().catch(''),
  charged: z.boolean().catch(false),
})
export type MeetingSummary = z.infer<typeof meetingSummarySchema>

export const meetingActionItemSchema = z.object({
  text: z.string(),
  /** Confirmed-only proposal provenance — the user decides before any task is created (REQ-026). */
  provenance: z.literal('ai-proposal').catch('ai-proposal'),
})
export type MeetingActionItem = z.infer<typeof meetingActionItemSchema>

export const meetingInsightsResultSchema = z.object({
  summary: meetingSummarySchema.catch({ source: 'deterministic', text: '', charged: false }),
  facts: z.array(z.string()).catch([]),
  actionItems: z.array(meetingActionItemSchema).catch([]),
})
export type MeetingInsightsResult = z.infer<typeof meetingInsightsResultSchema>

/** One transcript segment as the client captured it (optional speaker/timings, required text). */
export interface MeetingSegment {
  readonly speaker?: string
  readonly startMs?: number
  readonly endMs?: number
  readonly text: string
}

/** The meeting-insights request: the caller's own transcript plus an optional emphasis focus. */
export interface MeetingInsightsInput {
  readonly segments: readonly MeetingSegment[]
  /** Optional user focus (REQ-026): biases what an AI summary emphasises — grounding always wins. */
  readonly customPrompt?: string
}

export function parseMeetingInsightsResult(value: unknown): MeetingInsightsResult {
  return meetingInsightsResultSchema.parse(value)
}

/**
 * Ask for grounded meeting insights over the supplied transcript (read-only — the server writes
 * nothing, ADR-0005). Facts + action items are deterministic and free; only an AI summary costs a
 * credit, and a down provider degrades to a free deterministic summary.
 */
export async function requestMeetingInsights(
  baseUrl: string,
  input: MeetingInsightsInput,
  fetchImpl: typeof fetch = fetch,
): Promise<MeetingInsightsResult> {
  return parseMeetingInsightsResult(
    await postJson(baseUrl, '/api/ai/meeting-insights', input, fetchImpl),
  )
}
