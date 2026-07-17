import {
  actionItemProposals,
  transcriptFacts,
  type ActionItemProposal,
  type TranscriptSegment,
} from '@mydevtime/domain'
import { TranscriptionUnavailableError, type AudioInput, type TranscriptionPort } from './port.js'

/**
 * Meeting-insights planning (REQ-025/026): transcribe captured audio through the narrow
 * `TranscriptionPort`, then derive grounded insights with the deterministic core (ADR-0005) —
 * summary fact lines and **action items as confirmed-only proposals**. Two hard gates come first:
 * **consent** (no capture path without stored opt-in, REQ-025) and **Pro** (meeting AI is a paid
 * difference-maker, one credit charged only on a confirmed task), then **availability** (a down ASR
 * degrades to an empty result, never throws). Nothing is booked — a task is created only when the
 * user confirms a proposal. The live ASR adapter is spike-gated; the Null adapter proves the seam.
 */

export interface MeetingInsights {
  readonly transcript: readonly TranscriptSegment[]
  /** Grounded summary fact lines (action-like first) — the LLM only phrases these. */
  readonly facts: readonly string[]
  /** Action items, each an unconfirmed `ai-proposal` — confirmed-only task creation (REQ-026). */
  readonly actionItems: readonly ActionItemProposal[]
  readonly status: 'ok' | 'no-consent' | 'not-pro' | 'unavailable'
  /** Credits a confirmed task would cost (informational; charged on confirmation, not here). */
  readonly creditCost: number
}

/** Meeting AI is a Pro difference-maker: one credit per confirmed task (charged on confirmation). */
export const MEETING_INSIGHTS_CREDIT_COST = 1

const EMPTY = (status: MeetingInsights['status']): MeetingInsights => ({
  transcript: [],
  facts: [],
  actionItems: [],
  status,
  creditCost: MEETING_INSIGHTS_CREDIT_COST,
})

export interface MeetingInsightsGates {
  /** Whether the user has opted in to meeting capture (REQ-025) — checked before any ASR call. */
  readonly consented: boolean
  /** Whether the account holds Pro (the AI floor; ADR-0006). */
  readonly hasPro: boolean
}

/**
 * Plan meeting insights: consent-gated, Pro-gated, availability-gated, then a deterministic
 * transcript → facts + action-item proposals. Returns proposals only — the caller books/creates
 * nothing until the user confirms. A provider that throws `TranscriptionUnavailableError` mid-run
 * degrades to an empty `unavailable` result (ADR-0005).
 */
export async function planMeetingInsights(
  port: TranscriptionPort,
  audio: AudioInput,
  gates: MeetingInsightsGates,
): Promise<MeetingInsights> {
  if (!gates.consented) return EMPTY('no-consent')
  if (!gates.hasPro) return EMPTY('not-pro')
  if (!(await port.available())) return EMPTY('unavailable')
  let transcript: readonly TranscriptSegment[]
  try {
    transcript = await port.transcribe(audio)
  } catch (err) {
    if (err instanceof TranscriptionUnavailableError) return EMPTY('unavailable')
    throw err
  }
  return {
    transcript,
    facts: transcriptFacts(transcript),
    actionItems: actionItemProposals(transcript),
    status: 'ok',
    creditCost: MEETING_INSIGHTS_CREDIT_COST,
  }
}
