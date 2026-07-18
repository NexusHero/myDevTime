import type { TranscriptSegment } from '@mydevtime/domain'
import { TranscriptionUnavailableError, type AudioInput, type TranscriptionPort } from './port.js'

/**
 * The single live `TranscriptionPort` adapter (REQ-025, ADR-0009; skill §2.2): it speaks the
 * OpenAI-compatible `POST /v1/audio/transcriptions` contract, which covers **both** halves of the
 * spike-#31 recommendation — a self-hosted faster-whisper box (speaches/faster-whisper-server
 * expose exactly this API; privacy-default, no key) and hosted OpenAI Whisper as fallback (key
 * required) — one adapter, two deployments, selected by config. HTTP/wire types are confined to
 * this file; upstream sees only neutral `TranscriptSegment`s. The adapter transcribes only, never
 * mutates state, and any failure (network, timeout, non-2xx, malformed body) becomes
 * `TranscriptionUnavailableError` so the insights flow degrades uniformly (ADR-0005) — it never
 * fabricates transcript text. Consent is the service's gate and stays in front of every call.
 */

export interface WhisperHttpConfig {
  /** API host root (e.g. `https://api.openai.com` or `http://gpu-box:8000`); the adapter appends `/v1/audio/transcriptions`. */
  readonly baseUrl: string
  /** Bearer key for a hosted provider; a self-hosted faster-whisper box needs none. */
  readonly apiKey?: string
  /** Model name (`whisper-1` hosted; a size like `large-v3` on a self-hosted box). */
  readonly model: string
}

/** The narrow network dependency — tests inject a fake; production uses global `fetch`. */
export type FetchFn = typeof fetch

/** Batch transcription is minutes-scale on CPU (spike #31) — allow a full minute per request. */
const REQUEST_TIMEOUT_MS = 60_000

/** Multipart filename extensions for common capture MIME types (servers sniff by extension). */
const EXTENSION_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
}

/** Derive the multipart filename from the MIME type (`audio/webm` → `audio.webm`). */
function fileName(mimeType: string): string {
  const bare = mimeType.split(';')[0]?.trim().toLowerCase() ?? ''
  const ext = EXTENSION_BY_MIME[bare] ?? bare.split('/')[1] ?? 'bin'
  return `audio.${ext}`
}

/**
 * Map a `verbose_json` body to neutral segments, or `null` when the shape is unexpected.
 * The wire format times in **seconds** (float); the domain type is **milliseconds** — converted
 * here, once. No diarization on this contract, so `speaker` is simply omitted (it is optional).
 */
function mapVerboseJson(body: unknown): TranscriptSegment[] | null {
  if (typeof body !== 'object' || body === null) return null
  const segments = (body as { readonly segments?: unknown }).segments
  if (!Array.isArray(segments)) return null
  const mapped: TranscriptSegment[] = []
  for (const raw of segments) {
    if (typeof raw !== 'object' || raw === null) return null
    const { start, end, text } = raw as {
      readonly start?: unknown
      readonly end?: unknown
      readonly text?: unknown
    }
    if (typeof start !== 'number' || typeof end !== 'number' || typeof text !== 'string')
      return null
    mapped.push({ startMs: Math.round(start * 1000), endMs: Math.round(end * 1000), text })
  }
  return mapped
}

export class WhisperHttp implements TranscriptionPort {
  readonly provider = 'asr' as const
  private readonly config: WhisperHttpConfig
  private readonly fetchFn: FetchFn

  constructor(config: WhisperHttpConfig, fetchFn: FetchFn = fetch) {
    this.config = config
    this.fetchFn = fetchFn
  }

  /** Cheap config probe (mirrors `VercelLlm.available`): constructed with a base URL ⇒ configured. */
  available(): Promise<boolean> {
    return Promise.resolve(this.config.baseUrl.length > 0)
  }

  async transcribe(audio: AudioInput): Promise<readonly TranscriptSegment[]> {
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}/v1/audio/transcriptions`
    const bytes = new Uint8Array(Buffer.from(audio.base64, 'base64'))
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: audio.mimeType }), fileName(audio.mimeType))
    form.append('model', this.config.model)
    form.append('response_format', 'verbose_json')

    let response: Response
    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        body: form,
        ...(this.config.apiKey === undefined
          ? {}
          : { headers: { Authorization: `Bearer ${this.config.apiKey}` } }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'ASR request failed'
      throw new TranscriptionUnavailableError('asr', `ASR provider unreachable: ${reason}`)
    }
    if (!response.ok) {
      throw new TranscriptionUnavailableError(
        'asr',
        `ASR provider responded ${String(response.status)}`,
      )
    }
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new TranscriptionUnavailableError('asr', 'ASR provider returned invalid JSON')
    }
    const segments = mapVerboseJson(body)
    if (segments === null) {
      throw new TranscriptionUnavailableError('asr', 'ASR provider returned an unexpected shape')
    }
    return segments
  }
}
