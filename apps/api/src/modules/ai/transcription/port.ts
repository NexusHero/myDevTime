import type { TranscriptSegment } from '@mydevtime/domain'

/**
 * The one narrow ASR interface the app sees (REQ-025, ADR-0009; skill §2.2). Every speech-to-text
 * provider (a cloud ASR, a local Whisper) is reached through a single adapter that confines its
 * SDK/auth to that file and returns neutral domain `TranscriptSegment`s. **Nothing upstream imports
 * a vendor type.** Capture is **consent-first** (REQ-025): the service gates on stored opt-in before
 * ever calling the port. The port only transcribes; meeting insights are the deterministic core's
 * (ADR-0005), and a task is created only when the user confirms a proposal. The live ASR adapter is
 * gated on spike #31; the Null adapter ships now as the seam.
 */

export type TranscriptionProvider = 'asr' | 'null'

/** Captured audio to transcribe — a neutral wrapper; vendor audio types stay inside the adapter. */
export interface AudioInput {
  /** Base64-encoded audio bytes. */
  readonly base64: string
  /** MIME type, e.g. `audio/webm` / `audio/wav`. */
  readonly mimeType: string
}

/**
 * The narrow transcription port. A feature depends on this, never a vendor ASR SDK; the concrete
 * adapter is selected by config at composition time. Implementations transcribe only — they never
 * mutate app state (task creation is the confirmed-proposal flow's job, over the deterministic core).
 */
export interface TranscriptionPort {
  readonly provider: TranscriptionProvider
  /** Transcribe audio to segments. Throws `TranscriptionUnavailableError` when the provider is down. */
  transcribe(audio: AudioInput): Promise<readonly TranscriptSegment[]>
  /** Whether the ASR provider is configured and reachable (cheap; no transcription). */
  available(): Promise<boolean>
}

/**
 * Thrown when no ASR provider is configured or the chosen one is unreachable. The insights flow
 * handles this and degrades — the deterministic core never depends on ASR being up (ADR-0005).
 */
export class TranscriptionUnavailableError extends Error {
  readonly provider: TranscriptionProvider
  constructor(provider: TranscriptionProvider, message = 'transcription is not available') {
    super(message)
    this.name = 'TranscriptionUnavailableError'
    this.provider = provider
  }
}
