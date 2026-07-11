import { describe, expect, it } from 'vitest'
import { askAssistant, factsFromReports, parseAssistantResult } from './assistant.js'
import type { ReportsData } from '../hooks/useReports.js'

/**
 * The grounded-assistant client (M2): it derives factual sentences from the loaded
 * Reports, posts them with the question, and parses the answer + provenance. The
 * facts are the same figures the UI shows — never a raw or invented number.
 */
const DATA: ReportsData = {
  totalMs: 41 * 3_600_000 + 15 * 60_000,
  billableMinor: 254_000,
  currencyCode: 'EUR',
  overtimeMs: 90 * 60_000,
  byProject: [
    { id: 'p1', name: 'Finanzo', spentMs: 14 * 3_600_000, daily: [] },
    { id: 'p2', name: 'Sync engine', spentMs: 12 * 3_600_000, daily: [] },
  ],
  budgets: [
    { id: 'b1', name: 'Nordwind', ratio: 0.91, consumed: 0, basis: 'hours', currencyCode: 'EUR' },
  ],
}

describe('factsFromReports', () => {
  it('IncludesTrackedBillableOvertimeTopProjectAndBudgets', () => {
    const facts = factsFromReports(DATA)
    const joined = facts.join(' | ')
    expect(joined).toContain('getrackt')
    expect(joined).toContain('Abrechenbar')
    expect(joined).toContain('Überstundensaldo')
    expect(joined).toContain('Top-Projekt diese Woche: Finanzo')
    expect(joined).toContain('Budget Nordwind')
  })
})

describe('parseAssistantResult', () => {
  it('DefaultsSourceToDeterministicForUnknown', () => {
    expect(parseAssistantResult({ source: 'x', refused: false, text: 'y' }).source).toBe(
      'deterministic',
    )
  })
})

describe('askAssistant', () => {
  it('PostsQuestionAndFactsToTheAssistantRoute', async () => {
    let body: unknown
    const seen: string[] = []
    const fetchImpl = ((url: string, init?: RequestInit) => {
      seen.push(url)
      body = JSON.parse((init?.body as string | undefined) ?? '{}')
      return Promise.resolve(
        new Response(
          JSON.stringify({
            source: 'ai-proposal',
            refused: false,
            charged: true,
            text: 'Finanzo.',
          }),
          { status: 200 },
        ),
      )
    }) as unknown as typeof fetch
    const r = await askAssistant('http://api', 'Top-Projekt?', ['Top-Projekt: Finanzo.'], fetchImpl)
    expect(r.source).toBe('ai-proposal')
    expect(r.charged).toBe(true)
    expect(seen[0]).toContain('/api/ai/assistant')
    expect(body).toEqual({ question: 'Top-Projekt?', facts: ['Top-Projekt: Finanzo.'] })
  })
})
