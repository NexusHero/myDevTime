import { describe, expect, it } from 'vitest'
import { createRule, deleteRule, dryRunRules, getRules, parseRule, updateRule } from './rules.js'

/**
 * The categorization-rules client (REQ-011): parse the stored rule shape and hit the CRUD +
 * dry-run routes. The dry-run is a proposal surface — the client never books anything; it just
 * renders what the deterministic engine returned.
 */
const RULE = {
  id: 'r1',
  order: 1,
  version: 2,
  matcher: { noteContains: 'standup', sourceIs: 'calendar' },
  action: { setProjectId: 'p1', addTags: ['meeting'] },
  enabled: true,
}

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

describe('parseRule', () => {
  it('ReadsMatcherAndAction', () => {
    const r = parseRule(RULE)
    expect(r.matcher.noteContains).toBe('standup')
    expect(r.action.setProjectId).toBe('p1')
    expect(r.version).toBe(2)
  })

  it('DefaultsMissingFacetsSoUiNeverSeesUndefined', () => {
    const r = parseRule({ id: 'bare' })
    expect(r.matcher).toEqual({})
    expect(r.action).toEqual({})
    expect(r.enabled).toBe(true)
    expect(r.order).toBe(0)
  })
})

describe('requests', () => {
  it('GetsTheRuleList', async () => {
    const seen: Seen[] = []
    const list = await getRules('http://api', jsonFetch([RULE], seen))
    expect(list[0]?.id).toBe('r1')
    expect(seen[0]?.url).toContain('/api/automation/rules')
    expect(seen[0]?.method).toBe('GET')
  })

  it('CreatesARule', async () => {
    const seen: Seen[] = []
    await createRule('http://api', { matcher: { noteContains: 'sync' } }, jsonFetch(RULE, seen))
    expect(seen[0]?.url).toContain('/api/automation/rules')
    expect(seen[0]?.method).toBe('POST')
    expect(seen[0]?.body).toEqual({ matcher: { noteContains: 'sync' } })
  })

  it('PatchesARule', async () => {
    const seen: Seen[] = []
    await updateRule('http://api', 'r1', { enabled: false }, jsonFetch(RULE, seen))
    expect(seen[0]?.url).toContain('/api/automation/rules/r1')
    expect(seen[0]?.method).toBe('PATCH')
    expect(seen[0]?.body).toEqual({ enabled: false })
  })

  it('DeletesARule', async () => {
    const seen: Seen[] = []
    await deleteRule('http://api', 'r1', jsonFetch(null, seen))
    expect(seen[0]?.url).toContain('/api/automation/rules/r1')
    expect(seen[0]?.method).toBe('DELETE')
  })

  it('DryRunsSubjectsAndReadsTheProposal', async () => {
    const seen: Seen[] = []
    const rows = await dryRunRules(
      'http://api',
      [{ key: 'e1', subject: { note: 'standup', projectId: null } }],
      jsonFetch(
        [
          {
            key: 'e1',
            match: { ruleId: 'r1', action: { setProjectId: 'p1' }, provenance: 'rule:r1@2' },
          },
        ],
        seen,
      ),
    )
    expect(seen[0]?.url).toContain('/api/automation/rules/dry-run')
    expect(seen[0]?.method).toBe('POST')
    expect(rows[0]?.match?.ruleId).toBe('r1')
    expect(rows[0]?.match?.action.setProjectId).toBe('p1')
  })

  it('DryRunRowWithNoMatchIsNull', async () => {
    const seen: Seen[] = []
    const rows = await dryRunRules(
      'http://api',
      [{ key: 'e2', subject: { note: 'lunch' } }],
      jsonFetch([{ key: 'e2', match: null }], seen),
    )
    expect(rows[0]?.match).toBeNull()
  })
})
