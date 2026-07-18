import type { Provider } from '@nestjs/common'
import type { TranscriptionPort } from './port.js'
import { NullTranscription } from './null-transcription.js'
import { WhisperHttp, type WhisperHttpConfig } from './whisper-http.js'

/**
 * The DI token + provider that binds the configured `TranscriptionPort` (ADR-0009, following the
 * ADR-0029 env-driven pattern of `llm.provider.ts`). `ASR_PROVIDER=whisper-http` selects the one
 * OpenAI-compatible adapter, pointed at either deployment from spike #31: a self-hosted
 * faster-whisper box via `ASR_BASE_URL` alone (privacy-default, no key), or hosted OpenAI via
 * `ASR_API_KEY` alone (the base URL then defaults to `https://api.openai.com`). `ASR_MODEL`
 * defaults to `whisper-1`. Unset or incomplete configuration resolves the `NullTranscription`, so
 * meeting insights degrade gracefully by default (ADR-0005). Consumers inject `TRANSCRIPTION`,
 * never a vendor shape — and never a key from source: everything here reads from the environment.
 */
export const TRANSCRIPTION = Symbol('TRANSCRIPTION')

/** Hosted default when only a key is given — the OpenAI Whisper endpoint (spike #31 fallback). */
export const DEFAULT_HOSTED_BASE_URL = 'https://api.openai.com'
export const DEFAULT_ASR_MODEL = 'whisper-1'

/**
 * Resolve the ASR config from the environment. Returns `null` — meaning "use the
 * `NullTranscription`" — when `ASR_PROVIDER` is not `whisper-http`, or when neither a base URL
 * (self-hosted) nor an API key (hosted default base) is present.
 */
export function readTranscriptionConfig(
  env: NodeJS.ProcessEnv = process.env,
): WhisperHttpConfig | null {
  if (env.ASR_PROVIDER !== 'whisper-http') return null

  const apiKey = env.ASR_API_KEY
  const hasKey = apiKey !== undefined && apiKey !== ''
  const rawBaseUrl = env.ASR_BASE_URL
  const baseUrl =
    rawBaseUrl !== undefined && rawBaseUrl !== ''
      ? rawBaseUrl
      : hasKey
        ? DEFAULT_HOSTED_BASE_URL
        : undefined
  if (baseUrl === undefined) return null

  const model =
    env.ASR_MODEL !== undefined && env.ASR_MODEL !== '' ? env.ASR_MODEL : DEFAULT_ASR_MODEL
  return { baseUrl, model, ...(apiKey === undefined || apiKey === '' ? {} : { apiKey }) }
}

/** Build the configured port — the `WhisperHttp` adapter, or the graceful-degradation Null. */
export function createTranscription(env: NodeJS.ProcessEnv = process.env): TranscriptionPort {
  const config = readTranscriptionConfig(env)
  return config ? new WhisperHttp(config) : new NullTranscription()
}

export const transcriptionProvider: Provider = {
  provide: TRANSCRIPTION,
  useFactory: (): TranscriptionPort => createTranscription(),
}
