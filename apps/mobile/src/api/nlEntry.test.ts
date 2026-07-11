import { describe, expect, it } from 'vitest'
import {
  catalogVocabulary,
  draftToEntryTimes,
  fetchNlDraft,
  parseDraftResult,
  resolveProjectId,
  type NlDraft,
} from './nlEntry.js'
import type { Client } from '../screens/projectsData'

/**
 * The NL-entry client parses the draft the `ai` module returns, resolves the
 * project hint against the catalog, and turns a draft into concrete start/end
 * instants for the confirm step. These pin the parse (incl. the "no draft" case),
 * the request path, the name-match, and the time construction.
 */
const DRAFT = {
  durationMs: 7_200_000,
  dayOffset: -1,
  projectHint: 'Finanzo',
  note: 'review',
  billable: true,
  confidence: 1,
}

describe('parseDraftResult', () => {
  it('ReadsADraftWithItsSource', () => {
    const r = parseDraftResult({ draft: DRAFT, source: 'deterministic' })
    expect(r.source).toBe('deterministic')
    expect(r.draft?.projectHint).toBe('Finanzo')
  })
  it('HandlesTheNoDraftCase', () => {
    expect(parseDraftResult({ draft: null, source: 'none' })).toEqual({
      draft: null,
      source: 'none',
    })
  })
})

describe('fetchNlDraft', () => {
  it('PostsTheTextAndKnownProjectsToTheAiRoute', async () => {
    const seen: { url: string; body: unknown }[] = []
    const fetchImpl = ((url: string, init?: RequestInit) => {
      seen.push({ url, body: JSON.parse((init?.body as string | undefined) ?? '{}') })
      return Promise.resolve(
        new Response(JSON.stringify({ draft: DRAFT, source: 'deterministic' }), { status: 200 }),
      )
    }) as unknown as typeof fetch
    const r = await fetchNlDraft(
      'http://api',
      '2h Finanzo review yesterday',
      ['Finanzo'],
      fetchImpl,
    )
    expect(r.draft?.durationMs).toBe(7_200_000)
    expect(seen[0]?.url).toContain('/api/ai/nl-entry')
    expect(seen[0]?.body).toEqual({
      text: '2h Finanzo review yesterday',
      knownProjects: ['Finanzo'],
    })
  })

  it('OmitsKnownProjectsWhenTheCatalogIsEmpty', async () => {
    let sentBody: unknown
    const fetchImpl = ((_url: string, init?: RequestInit) => {
      sentBody = JSON.parse((init?.body as string | undefined) ?? '{}')
      return Promise.resolve(
        new Response(JSON.stringify({ draft: null, source: 'none' }), { status: 200 }),
      )
    }) as unknown as typeof fetch
    await fetchNlDraft('http://api', 'kaffee', [], fetchImpl)
    expect(sentBody).toEqual({ text: 'kaffee' })
  })
})

describe('catalogVocabulary', () => {
  it('FlattensProjectNamesAcrossClients', () => {
    const catalog = [
      { id: 'c1', name: 'Acme', projects: [{ id: 'p1', name: 'Logo', tasks: [] }] },
      { id: 'c2', name: 'Beta', projects: [{ id: 'p2', name: 'Finanzo', tasks: [] }] },
    ] as unknown as Client[]
    expect(catalogVocabulary(catalog)).toEqual(['Logo', 'Finanzo'])
  })
})

describe('resolveProjectId', () => {
  const catalog: Client[] = [
    {
      id: 'c1',
      name: 'Acme',
      projects: [
        { id: 'p1', name: 'Finanzo', tasks: [] },
        { id: 'p2', name: 'Finanzo Mobile', tasks: [] },
      ],
    },
  ] as unknown as Client[]
  it('PrefersAnExactNameMatch', () => {
    expect(resolveProjectId(catalog, 'finanzo')).toBe('p1')
  })
  it('FallsBackToAPrefixMatch', () => {
    expect(resolveProjectId(catalog, 'Finanzo M')).toBe('p2')
  })
  it('IsNullWithoutAHintOrMatch', () => {
    expect(resolveProjectId(catalog, null)).toBeNull()
    expect(resolveProjectId(catalog, 'Nordwind')).toBeNull()
  })
})

describe('draftToEntryTimes', () => {
  it('EndsNowForAToday', () => {
    const now = new Date('2026-07-10T15:00:00.000Z')
    const draft: NlDraft = { ...DRAFT, dayOffset: 0, durationMs: 3_600_000 }
    const { startedAt, endedAt } = draftToEntryTimes(draft, now)
    expect(endedAt).toBe('2026-07-10T15:00:00.000Z')
    expect(startedAt).toBe('2026-07-10T14:00:00.000Z')
  })
  it('SpansTheDurationEndingBeforeNow', () => {
    const now = new Date('2026-07-10T15:00:00.000Z')
    const { startedAt, endedAt } = draftToEntryTimes({ ...DRAFT, dayOffset: 0 }, now)
    expect(Date.parse(endedAt) - Date.parse(startedAt)).toBe(7_200_000)
  })
})
