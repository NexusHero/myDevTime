import { describe, expect, it } from 'vitest'
import { getLoadHistory } from './loadHistory.js'

/**
 * The load-history client seam (ADR-0071 P1): the caller's own load-score series, the raw
 * input to `computeBaseline` (H3). These pin the route + window query with the closure-capture
 * fake fetch, the zod parse of the rows, and that a malformed row throws — the client never
 * fabricates a history.
 */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('getLoadHistory', () => {
  it('ReadsTheWindowedSeries_AndParsesTheRows', async () => {
    let seenUrl = ''
    const fetchImpl = ((url: string) => {
      seenUrl = url
      return Promise.resolve(
        jsonResponse(200, [
          { loadScore: 1.5, weekday: 1 },
          { loadScore: 6, weekday: 2 },
        ]),
      )
    }) as unknown as typeof fetch

    const out = await getLoadHistory('https://api.test', 30, fetchImpl)

    expect(out).toEqual([
      { loadScore: 1.5, weekday: 1 },
      { loadScore: 6, weekday: 2 },
    ])
    expect(seenUrl).toBe('https://api.test/api/wellbeing/load-history?days=30')
  })

  it('MalformedRow_Throws_NeverInventsAHistory', async () => {
    const fetchImpl = (() =>
      Promise.resolve(
        jsonResponse(200, [{ loadScore: 'high', weekday: 9 }]),
      )) as unknown as typeof fetch

    await expect(getLoadHistory('https://api.test', 90, fetchImpl)).rejects.toThrow()
  })
})
