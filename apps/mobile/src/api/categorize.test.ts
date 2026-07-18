import { describe, expect, it } from 'vitest'
import { applyCategoryProposal, parseCategorizeResult, proposeCategories } from './categorize.js'

/**
 * The AI categorization client (REQ-012): post the entry projections + vocabulary, parse the
 * proposal list defensively, and apply one accepted proposal through the ordinary tracking
 * PATCH. Proposals never self-apply — Apply is a separate, user-driven call (ADR-0005).
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
  charged: true,
  proposals: [
    { key: 'e1', project: 'Website', tags: ['meeting'], billable: true, confidence: 'high' },
  ],
}

const ENTRY = {
  id: 'e1',
  projectId: 'p1',
  taskId: null,
  startedAt: '2026-07-18T08:00:00.000Z',
  endedAt: '2026-07-18T09:00:00.000Z',
  billable: true,
  source: 'timer',
  note: 'standup with team',
}

describe('proposeCategories', () => {
  it('PostsItemsAndVocabularyToTheCategorizeRoute', async () => {
    const seen: Seen[] = []
    const items = [{ key: 'e1', note: 'standup with team', source: 'timer' }]
    const res = await proposeCategories('http://api', items, ['Website'], jsonFetch(RESULT, seen))
    expect(seen[0]?.url).toContain('/api/ai/categorize')
    expect(seen[0]?.method).toBe('POST')
    expect(seen[0]?.body).toEqual({ items, knownProjects: ['Website'] })
    expect(res.source).toBe('ai-proposal')
    expect(res.proposals[0]?.project).toBe('Website')
    expect(res.proposals[0]?.confidence).toBe('high')
  })

  it('DefaultsAnUnknownSourceToNone_AndMalformedProposalFieldsPerRow', () => {
    const res = parseCategorizeResult({
      source: 'weird',
      proposals: [{ key: 'e2', project: 42, tags: 'nope', billable: 'yes', confidence: 'huge' }],
    })
    expect(res.source).toBe('none')
    expect(res.charged).toBe(false)
    expect(res.proposals[0]).toEqual({
      key: 'e2',
      project: null,
      tags: [],
      billable: null,
      confidence: 'low',
    })
  })

  it('DefaultsAMalformedProposalListToEmpty', () => {
    const res = parseCategorizeResult({ source: 'ai-proposal', proposals: 'garbage' })
    expect(res.proposals).toEqual([])
  })
})

describe('applyCategoryProposal', () => {
  it('PatchesTheEntryThroughTheTrackingRoute', async () => {
    const seen: Seen[] = []
    const updated = await applyCategoryProposal(
      'http://api',
      'e1',
      { projectId: 'p1', billable: true },
      jsonFetch(ENTRY, seen),
    )
    expect(seen[0]?.url).toContain('/api/tracking/entries/e1')
    expect(seen[0]?.method).toBe('PATCH')
    expect(seen[0]?.body).toEqual({ projectId: 'p1', billable: true })
    expect(updated.projectId).toBe('p1')
  })
})
