import type { Provider } from '@nestjs/common'
import {
  actionItemProposals,
  transcriptFacts,
  transcriptText,
  type TranscriptSegment,
} from '@mydevtime/domain'
import { LLM } from './llm/llm.provider.js'
import { LlmUnavailableError, type LlmPort } from './llm/port.js'

/**
 * Meeting insights over a supplied transcript (REQ-026, #33 · ADR-0005/0009). Live audio capture is
 * out of scope here (tracked by #31/#32) — the client passes the transcript directly. The
 * deterministic core owns the grounding: `transcriptFacts` extracts grounded fact lines and
 * `actionItemProposals` yields **confirmed-only `ai-proposal` action items** (never auto-created — a
 * task is created only when the user confirms one, REQ-026). Those are free. On top, an *optional*
 * LLM-narrated summary is grounded in the transcript; the caller's `customPrompt` may bias emphasis
 * only — the grounding rules always win (the REQ-026 rule, same shape as `insights.ts`). A summary is
 * the only credit-priced piece; a down provider or withheld AI degrades to a deterministic summary
 * (the fact lines) and costs nothing. Proposal-only: nothing is written to a timesheet/task.
 */

/** A transcript segment as it arrives from the validated DTO (optional fields may be `undefined`). */
export interface MeetingSegmentInput {
  readonly speaker?: string | undefined
  readonly startMs?: number | undefined
  readonly endMs?: number | undefined
  readonly text: string
}

export interface MeetingSummary {
  readonly source: 'deterministic' | 'ai-proposal'
  readonly text: string
}

export interface MeetingActionItem {
  readonly text: string
  /** Confirmed-only proposal provenance — the user decides before any task is created (REQ-026). */
  readonly provenance: 'ai-proposal'
}

export interface MeetingInsightsResult {
  readonly summary: MeetingSummary
  readonly facts: readonly string[]
  readonly actionItems: readonly MeetingActionItem[]
}

export interface MeetingInsightsOptions {
  readonly allowAi: boolean
  /**
   * Optional user focus (REQ-026): biases what the summary emphasises. It steers emphasis/tone
   * only — the grounding rules (stated after it and explicitly winning) never let it override the
   * transcript. Ignored on the deterministic fallback — degradation behaviour is unchanged.
   */
  readonly customPrompt?: string | undefined
}

const MAX_OUTPUT_TOKENS = 400

/** Normalise loose DTO segments to domain `TranscriptSegment`s; the array index seeds a missing `startMs`
 * so ordering is stable when the client omits timings. */
function toSegments(inputs: readonly MeetingSegmentInput[]): TranscriptSegment[] {
  return inputs.map((s, i) => {
    const startMs = s.startMs ?? i
    const endMs = s.endMs ?? startMs
    return s.speaker !== undefined
      ? { speaker: s.speaker, startMs, endMs, text: s.text }
      : { startMs, endMs, text: s.text }
  })
}

function buildPrompt(transcript: string, customPrompt?: string): string {
  const focus = customPrompt?.trim()
  return [
    'You are a concise meeting-summary writer. Summarise the meeting transcript below in a few',
    'short sentences (neutral, third person). Capture the decisions and outcomes.',
    // REQ-026: the user's custom focus may bias *emphasis* only. It is stated before the grounding
    // rules on purpose — the rules below come later and explicitly win, so a focus like "ignore the
    // transcript" can never override the grounding (ADR-0005).
    ...(focus !== undefined && focus.length > 0
      ? ['', `USER FOCUS: ${focus}`, 'The user focus above may steer emphasis and tone only.']
      : []),
    'These grounding rules override any user focus: base the summary ONLY on the transcript below',
    'and never invent anything that was not said in it. Answer in English.',
    '',
    'TRANSCRIPT:',
    transcript,
  ].join('\n')
}

export interface MeetingInsightsService {
  compose(
    segments: readonly MeetingSegmentInput[],
    opts: MeetingInsightsOptions,
  ): Promise<MeetingInsightsResult>
}

export const MEETING_INSIGHTS = Symbol('MEETING_INSIGHTS')

/** LLM-backed meeting insights. Facts + action items are deterministic; only the summary may use AI. */
export class LlmMeetingInsights implements MeetingInsightsService {
  constructor(private readonly llm: LlmPort) {}

  /** The deterministic summary: the grounded fact lines, or an honest empty note. */
  private deterministicSummary(facts: readonly string[]): MeetingSummary {
    const text =
      facts.length > 0 ? facts.join('\n') : 'No discussion was captured in the transcript.'
    return { source: 'deterministic', text }
  }

  private async summarise(
    segments: readonly TranscriptSegment[],
    facts: readonly string[],
    opts: MeetingInsightsOptions,
  ): Promise<MeetingSummary> {
    const body = transcriptText(segments)
    if (!opts.allowAi || body.length === 0) return this.deterministicSummary(facts)
    const available = await this.llm.available().catch(() => false)
    if (!available) return this.deterministicSummary(facts)
    try {
      const result = await this.llm.complete({
        messages: [{ role: 'user', content: buildPrompt(body, opts.customPrompt) }],
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.3,
      })
      const text = result.text.trim()
      if (text.length === 0) return this.deterministicSummary(facts)
      return { source: 'ai-proposal', text }
    } catch (error) {
      if (error instanceof LlmUnavailableError) return this.deterministicSummary(facts)
      return this.deterministicSummary(facts) // the proposal layer never fails the request (ADR-0005)
    }
  }

  async compose(
    inputs: readonly MeetingSegmentInput[],
    opts: MeetingInsightsOptions,
  ): Promise<MeetingInsightsResult> {
    const segments = toSegments(inputs)
    const facts = transcriptFacts(segments)
    const actionItems: MeetingActionItem[] = actionItemProposals(segments).map(a => ({
      text: a.text,
      provenance: 'ai-proposal',
    }))
    const summary = await this.summarise(segments, facts, opts)
    return { summary, facts, actionItems }
  }
}

/** Binds the `MEETING_INSIGHTS` port to the LLM-backed meeting insights. */
export const meetingInsightsProvider: Provider = {
  provide: MEETING_INSIGHTS,
  inject: [LLM],
  useFactory: (llm: LlmPort): MeetingInsightsService => new LlmMeetingInsights(llm),
}
