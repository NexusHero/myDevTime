import { describe, expect, it } from 'vitest'
import { generateStandup, parseStandupResult } from './standup.js'

/**
 * The AI standup client (REQ-014): hit the `ai` route with the caller's own grouped lines
 * and parse the narrated result. Provenance (`source`) and the credit charge are defaulted
 * defensively — the UI must always be able to show where the text came from (ADR-0005).
 */
interface Seen {
  url: string
  method: string | undefined
  body: unknown
}

const jsonFetch = (body: unknown, seen: Seen[]): typeof fetch =>
  ((url: string, init?: RequestInit) => {
    seen.push({
      url,
      method: init?.method,
      body: init?.body === undefined ? undefined : JSON.parse(init.body as string),
    })
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  }) as unknown as typeof fetch

const RESULT = {
  source: 'ai-proposal',
  text: 'Yesterday I shipped the report. Today I continue.',
  charged: true,
  report: { date: '2026-07-18', yesterday: [], today: [] },
}

describe('generateStandup', () => {
  it('PostsTheLinesToTheStandupRoute', async () => {
    const seen: Seen[] = []
    const input = {
      date: '2026-07-18',
      yesterday: [{ label: 'Website', ms: 3_600_000 }],
      today: [{ label: 'Tracked', ms: 1_800_000 }],
      blockers: [],
    }
    const res = await generateStandup('http://api', input, jsonFetch(RESULT, seen))
    expect(seen[0]?.url).toContain('/api/ai/standup')
    expect(seen[0]?.method).toBe('POST')
    expect(seen[0]?.body).toEqual(input)
    expect(res.text).toContain('Yesterday I shipped')
    expect(res.source).toBe('ai-proposal')
    expect(res.charged).toBe(true)
  })

  it('DefaultsAnUnknownSourceToDeterministic_SoProvenanceIsAlwaysShowable', () => {
    const res = parseStandupResult({ source: 'weird', text: 'plain report', report: {} })
    expect(res.source).toBe('deterministic')
    expect(res.charged).toBe(false)
  })

  it('DefaultsAMissingReportToAnEmptyObject', () => {
    const res = parseStandupResult({ source: 'deterministic', text: 'x', charged: false })
    expect(res.report).toEqual({})
  })
})
