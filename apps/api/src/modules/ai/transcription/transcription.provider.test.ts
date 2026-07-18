import { describe, expect, it } from 'vitest'
import { NullTranscription } from './null-transcription.js'
import { WhisperHttp } from './whisper-http.js'
import {
  DEFAULT_ASR_MODEL,
  DEFAULT_HOSTED_BASE_URL,
  createTranscription,
  readTranscriptionConfig,
} from './transcription.provider.js'

describe('readTranscriptionConfig — env matrix (ADR-0029 pattern)', () => {
  it('UnsetProvider_ResolvesNull', () => {
    expect(readTranscriptionConfig({})).toBeNull()
  })

  it('UnknownProvider_ResolvesNull', () => {
    expect(readTranscriptionConfig({ ASR_PROVIDER: 'deepgram', ASR_API_KEY: 'k' })).toBeNull()
  })

  it('WhisperHttpWithoutBaseUrlOrKey_IsIncomplete_ResolvesNull', () => {
    expect(readTranscriptionConfig({ ASR_PROVIDER: 'whisper-http' })).toBeNull()
  })

  it('BaseUrlOnly_SelfHostedFasterWhisper_NoKeyNeeded', () => {
    const config = readTranscriptionConfig({
      ASR_PROVIDER: 'whisper-http',
      ASR_BASE_URL: 'http://asr.internal:8000',
    })
    expect(config).toEqual({ baseUrl: 'http://asr.internal:8000', model: DEFAULT_ASR_MODEL })
    expect(config).not.toHaveProperty('apiKey')
  })

  it('KeyOnly_DefaultsToTheHostedOpenAiBaseUrl', () => {
    const config = readTranscriptionConfig({
      ASR_PROVIDER: 'whisper-http',
      ASR_API_KEY: 'sk-test',
    })
    expect(config).toEqual({
      baseUrl: DEFAULT_HOSTED_BASE_URL,
      model: DEFAULT_ASR_MODEL,
      apiKey: 'sk-test',
    })
    expect(DEFAULT_HOSTED_BASE_URL).toBe('https://api.openai.com')
  })

  it('ExplicitBaseUrlModelAndKey_AreAllHonoured', () => {
    expect(
      readTranscriptionConfig({
        ASR_PROVIDER: 'whisper-http',
        ASR_BASE_URL: 'https://eu-asr.example.com',
        ASR_API_KEY: 'sk-eu',
        ASR_MODEL: 'large-v3',
      }),
    ).toEqual({ baseUrl: 'https://eu-asr.example.com', model: 'large-v3', apiKey: 'sk-eu' })
  })

  it('EmptyStrings_CountAsUnset', () => {
    expect(
      readTranscriptionConfig({ ASR_PROVIDER: 'whisper-http', ASR_BASE_URL: '', ASR_API_KEY: '' }),
    ).toBeNull()
  })
})

describe('createTranscription — graceful degradation by default (ADR-0005)', () => {
  it('UnconfiguredEnv_ResolvesTheNullTranscription', () => {
    const port = createTranscription({})
    expect(port).toBeInstanceOf(NullTranscription)
    expect(port.provider).toBe('null')
  })

  it('SelfHostedBaseUrlOnly_ResolvesTheWhisperHttpAdapter', () => {
    const port = createTranscription({
      ASR_PROVIDER: 'whisper-http',
      ASR_BASE_URL: 'http://asr.internal:8000',
    })
    expect(port).toBeInstanceOf(WhisperHttp)
    expect(port.provider).toBe('asr')
  })

  it('IncompleteWhisperHttpEnv_StillDegradesToNull', () => {
    expect(createTranscription({ ASR_PROVIDER: 'whisper-http' })).toBeInstanceOf(NullTranscription)
  })
})
