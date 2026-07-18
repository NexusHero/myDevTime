import { describe, expect, it } from 'vitest'
import { TranscriptionUnavailableError, type AudioInput } from './port.js'
import { WhisperHttp, type FetchFn, type WhisperHttpConfig } from './whisper-http.js'

const AUDIO_BYTES = 'fake-audio-bytes'
const audio: AudioInput = {
  base64: Buffer.from(AUDIO_BYTES).toString('base64'),
  mimeType: 'audio/webm',
}

/** A canonical OpenAI-compatible `verbose_json` reply (times in seconds, as on the wire). */
const verboseJson = {
  task: 'transcribe',
  language: 'en',
  duration: 2.5,
  text: 'We reviewed the roadmap Action: Alice will send the report',
  segments: [
    { id: 0, start: 0, end: 1.234, text: 'We reviewed the roadmap' },
    { id: 1, start: 1.234, end: 2.5, text: 'Action: Alice will send the report' },
  ],
}

interface RecordedCall {
  readonly url: string
  readonly init: RequestInit | undefined
}

/** Fake-fetch factory: records the request, then replies (or throws) — no network. */
function fakeFetch(result: Response | Error, calls: RecordedCall[]): FetchFn {
  return (input, init): Promise<Response> => {
    calls.push({ url: input as string, init })
    if (result instanceof Error) return Promise.reject(result)
    return Promise.resolve(result)
  }
}

const okJson = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const config: WhisperHttpConfig = {
  baseUrl: 'http://asr.internal:8000',
  model: 'large-v3',
}

describe('WhisperHttp request shape', () => {
  it('PostsMultipartToTheOpenAiCompatibleEndpoint_withModelAndVerboseJson', async () => {
    const calls: RecordedCall[] = []
    const port = new WhisperHttp(config, fakeFetch(okJson(verboseJson), calls))

    await port.transcribe(audio)

    expect(calls).toHaveLength(1)
    const call = calls[0]!
    expect(call.url).toBe('http://asr.internal:8000/v1/audio/transcriptions')
    expect(call.init?.method).toBe('POST')
    expect(call.init?.signal).toBeInstanceOf(AbortSignal)
    const form = call.init?.body as FormData
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('model')).toBe('large-v3')
    expect(form.get('response_format')).toBe('verbose_json')
    const file = form.get('file') as File
    expect(file.name).toBe('audio.webm')
    expect(file.type).toBe('audio/webm')
    expect(Buffer.from(await file.arrayBuffer()).toString()).toBe(AUDIO_BYTES)
  })

  it('SelfHostedWithoutKey_SendsNoAuthorizationHeader', async () => {
    const calls: RecordedCall[] = []
    const port = new WhisperHttp(config, fakeFetch(okJson(verboseJson), calls))

    await port.transcribe(audio)

    expect(calls[0]!.init?.headers).toBeUndefined()
  })

  it('HostedWithKey_SendsBearerAuthorization', async () => {
    const calls: RecordedCall[] = []
    const port = new WhisperHttp(
      { baseUrl: 'https://api.openai.com', model: 'whisper-1', apiKey: 'sk-test' },
      fakeFetch(okJson(verboseJson), calls),
    )

    await port.transcribe(audio)

    expect(calls[0]!.url).toBe('https://api.openai.com/v1/audio/transcriptions')
    expect(calls[0]!.init?.headers).toEqual({ Authorization: 'Bearer sk-test' })
  })

  it('TrailingSlashBaseUrl_DoesNotDoubleTheSlash', async () => {
    const calls: RecordedCall[] = []
    const port = new WhisperHttp(
      { baseUrl: 'http://asr.internal:8000/', model: 'large-v3' },
      fakeFetch(okJson(verboseJson), calls),
    )

    await port.transcribe(audio)

    expect(calls[0]!.url).toBe('http://asr.internal:8000/v1/audio/transcriptions')
  })

  it('WavMimeType_NamesTheMultipartFileAccordingly', async () => {
    const calls: RecordedCall[] = []
    const port = new WhisperHttp(config, fakeFetch(okJson(verboseJson), calls))

    await port.transcribe({ base64: audio.base64, mimeType: 'audio/wav' })

    const file = (calls[0]!.init?.body as FormData).get('file') as File
    expect(file.name).toBe('audio.wav')
  })
})

describe('WhisperHttp segment mapping', () => {
  it('MapsVerboseJsonSecondsToMillisecondSegments_withoutSpeaker', async () => {
    const port = new WhisperHttp(config, fakeFetch(okJson(verboseJson), []))

    const segments = await port.transcribe(audio)

    expect(segments).toEqual([
      { startMs: 0, endMs: 1234, text: 'We reviewed the roadmap' },
      { startMs: 1234, endMs: 2500, text: 'Action: Alice will send the report' },
    ])
    for (const segment of segments) expect('speaker' in segment).toBe(false)
  })

  it('EmptySegments_MapsToAnEmptyTranscript', async () => {
    const port = new WhisperHttp(config, fakeFetch(okJson({ text: '', segments: [] }), []))

    await expect(port.transcribe(audio)).resolves.toEqual([])
  })
})

describe('WhisperHttp degradation (ADR-0005) — errors become unavailable, never fabricated text', () => {
  it('ApiError_RejectsWithTranscriptionUnavailable', async () => {
    const port = new WhisperHttp(config, fakeFetch(new Response('nope', { status: 500 }), []))

    await expect(port.transcribe(audio)).rejects.toBeInstanceOf(TranscriptionUnavailableError)
  })

  it('NetworkFailure_RejectsWithTranscriptionUnavailable', async () => {
    const port = new WhisperHttp(config, fakeFetch(new TypeError('fetch failed'), []))

    await expect(port.transcribe(audio)).rejects.toBeInstanceOf(TranscriptionUnavailableError)
  })

  it('NonJsonBody_RejectsWithTranscriptionUnavailable', async () => {
    const port = new WhisperHttp(config, fakeFetch(new Response('not json', { status: 200 }), []))

    await expect(port.transcribe(audio)).rejects.toBeInstanceOf(TranscriptionUnavailableError)
  })

  it('UnexpectedShape_RejectsWithTranscriptionUnavailable', async () => {
    const port = new WhisperHttp(config, fakeFetch(okJson({ text: 'no segments array' }), []))

    await expect(port.transcribe(audio)).rejects.toBeInstanceOf(TranscriptionUnavailableError)
  })

  it('MalformedSegmentEntry_RejectsWithTranscriptionUnavailable', async () => {
    const body = { segments: [{ start: 'zero', end: 1, text: 'bad' }] }
    const port = new WhisperHttp(config, fakeFetch(okJson(body), []))

    await expect(port.transcribe(audio)).rejects.toBeInstanceOf(TranscriptionUnavailableError)
  })

  it('UnavailableError_CarriesTheAsrProviderTag', async () => {
    const port = new WhisperHttp(config, fakeFetch(new Response('', { status: 503 }), []))

    await expect(port.transcribe(audio)).rejects.toMatchObject({ provider: 'asr' })
  })
})

describe('WhisperHttp availability', () => {
  it('ConfiguredAdapter_ReportsAvailable_withoutTouchingTheNetwork', async () => {
    const calls: RecordedCall[] = []
    const port = new WhisperHttp(config, fakeFetch(okJson(verboseJson), calls))

    expect(await port.available()).toBe(true)
    expect(calls).toHaveLength(0)
  })
})
