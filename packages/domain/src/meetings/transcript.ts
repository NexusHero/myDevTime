import { looksLikeAction, meetingNotesFacts, type MeetingNotesOptions } from './notes.js'

/**
 * Meeting-transcript core (REQ-025/026, ADR-0005/0009) — the deterministic grounding for AI meeting
 * insights. An ASR adapter (behind the `TranscriptionPort`, consent-first) turns captured audio into
 * neutral `TranscriptSegment`s; this pure core flattens them to text, extracts grounded fact lines
 * (reusing the notes core), and proposes **action items as confirmed-only proposals** — the LLM only
 * phrases these grounded facts, and a task is created only when the user confirms one (REQ-026).
 * No model, no I/O here: it never invents content, only shapes the transcript the user consented to.
 */

/** One ASR segment — the neutral shape every transcription adapter returns. */
export interface TranscriptSegment {
  /** Optional speaker label/diarization tag. */
  readonly speaker?: string
  readonly startMs: number
  /** Exclusive end. */
  readonly endMs: number
  readonly text: string
}

/** Flatten segments to one transcript text, in time order, dropping empties. */
export function transcriptText(segments: readonly TranscriptSegment[]): string {
  return segments
    .filter(s => s.text.trim().length > 0)
    .slice()
    .sort((a, b) => a.startMs - b.startMs)
    .map(s => s.text.trim())
    .join('\n')
}

/** Grounded fact lines from a transcript — action-like first — via the shared notes core. */
export function transcriptFacts(
  segments: readonly TranscriptSegment[],
  opts: MeetingNotesOptions = {},
): string[] {
  return meetingNotesFacts(transcriptText(segments), opts)
}

/** An action item proposed from the transcript — a proposal, never a booked task (REQ-026). */
export interface ActionItemProposal {
  readonly text: string
  /** Provenance: grounded in the transcript, phrased by AI — the user decides (ADR-0005). */
  readonly source: 'ai-proposal'
  /** Always false here: a task is created only when the user confirms this proposal. */
  readonly confirmed: false
}

export interface ActionItemOptions {
  /** Maximum proposals to return (default 10). */
  readonly max?: number
}

/**
 * The confirmed-only action-item proposals from a transcript: the action-like grounded fact lines,
 * de-duplicated and ordered by the notes core, each wrapped as an unconfirmed `ai-proposal`. Nothing
 * is booked — the caller creates a task only when the user confirms a proposal (REQ-026, ADR-0005).
 */
export function actionItemProposals(
  segments: readonly TranscriptSegment[],
  opts: ActionItemOptions = {},
): ActionItemProposal[] {
  const max = opts.max ?? 10
  return transcriptFacts(segments, { max: 100 })
    .filter(line => looksLikeAction(line))
    .slice(0, max)
    .map(text => ({ text, source: 'ai-proposal' as const, confirmed: false as const }))
}
