import { TranscriptionUnavailableError, type AudioInput, type TranscriptionPort } from './port.js'
import type { TranscriptSegment } from '@mydevtime/domain'

/**
 * The graceful-degradation default (REQ-025, mirrors ADR-0029's `NullLlm`): the `TranscriptionPort`
 * used when no ASR provider is configured or none is reachable. `available()` is always false and
 * `transcribe()` refuses with `TranscriptionUnavailableError`, so the meeting-insights flow degrades
 * and the deterministic core is untouched (ADR-0005). It is the seam the insights feature tests
 * against before any live ASR adapter exists (that adapter is gated on spike #31).
 */
export class NullTranscription implements TranscriptionPort {
  readonly provider = 'null' as const

  transcribe(_audio: AudioInput): Promise<readonly TranscriptSegment[]> {
    return Promise.reject(new TranscriptionUnavailableError('null', 'no ASR provider configured'))
  }

  available(): Promise<boolean> {
    return Promise.resolve(false)
  }
}
