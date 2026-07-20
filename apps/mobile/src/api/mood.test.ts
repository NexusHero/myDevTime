import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './http.js'
import { deleteMoodHistory, getMoodHistory, postMood } from './mood.js'

/**
 * The mood client seam (ADR-0071 P3, REQ-068): POST the punch-out word, read the history
 * newest-first, and erase it all with one DELETE. These pin the routes/methods with the
 * closure-capture fake fetch, the zod parse of each response, and that the server's honest
 * consent-409 surfaces as an `ApiError` the MoodCheck can explain — never a silent drop.
 */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('postMood', () => {
  it('PostsTheWordToTheMoodRoute_AndParsesTheStoredDay', async () => {
    let seenUrl = ''
    let seenInit: RequestInit | undefined
    const fetchImpl = ((url: string, init?: RequestInit) => {
      seenUrl = url
      seenInit = init
      return Promise.resolve(jsonResponse(200, { day: '2026-07-20', mood: 'tense' }))
    }) as unknown as typeof fetch

    const out = await postMood('https://api.test', 'tense', fetchImpl)

    expect(out).toEqual({ day: '2026-07-20', mood: 'tense' })
    expect(seenUrl).toBe('https://api.test/api/wellbeing/mood')
    expect(seenInit?.method).toBe('POST')
    expect(JSON.parse((seenInit?.body as string | undefined) ?? '{}')).toEqual({ mood: 'tense' })
  })

  it('ConsentDenied409_SurfacesAsAnApiError', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse(409, { title: 'Conflict', detail: 'mood memory requires consent' }),
      ),
    )
    await expect(
      postMood('https://api.test', 'good', fetchImpl as typeof fetch),
    ).rejects.toMatchObject({ name: 'ApiError', status: 409, title: 'Conflict' })
  })
})

describe('getMoodHistory', () => {
  it('GetsTheHistoryAndParsesEachDay', async () => {
    let seenUrl = ''
    const fetchImpl = ((url: string) => {
      seenUrl = url
      return Promise.resolve(
        jsonResponse(200, [
          { day: '2026-07-20', mood: 'good' },
          { day: '2026-07-19', mood: 'stressed' },
        ]),
      )
    }) as unknown as typeof fetch

    const history = await getMoodHistory('https://api.test', fetchImpl)

    expect(seenUrl).toBe('https://api.test/api/wellbeing/mood')
    expect(history).toEqual([
      { day: '2026-07-20', mood: 'good' },
      { day: '2026-07-19', mood: 'stressed' },
    ])
  })

  it('MalformedHistory_ThrowsRatherThanInventingMoods', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(200, [{ mood: 'euphoric' }])))
    await expect(getMoodHistory('https://api.test', fetchImpl as typeof fetch)).rejects.toThrow()
  })
})

describe('deleteMoodHistory', () => {
  it('DeletesTheWholeHistoryWithOneCall', async () => {
    let seenUrl = ''
    let seenInit: RequestInit | undefined
    const fetchImpl = ((url: string, init?: RequestInit) => {
      seenUrl = url
      seenInit = init
      return Promise.resolve(jsonResponse(200, { deleted: true }))
    }) as unknown as typeof fetch

    await deleteMoodHistory('https://api.test', fetchImpl)

    expect(seenUrl).toBe('https://api.test/api/wellbeing/mood')
    expect(seenInit?.method).toBe('DELETE')
  })

  it('NetworkFailure_ThrowsApiError', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('offline')))
    const err = await deleteMoodHistory('https://api.test', fetchImpl as typeof fetch).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(0)
  })
})
