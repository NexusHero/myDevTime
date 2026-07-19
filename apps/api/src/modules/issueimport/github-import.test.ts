import { describe, expect, it } from 'vitest'
import { GithubImport } from './github-import.js'
import { IssueImportUnavailableError } from './port.js'

/**
 * The live GitHub Issues adapter — proven entirely against a fake fetch, no network. Confirms the
 * `/issues?filter=assigned` → `ExternalIssue` translation (key `owner/repo#number`, labels, state,
 * assignee, title fallback, PR skip), the exact request shape (endpoint, params, bearer auth +
 * github accept header), the `state` param, and that every failure degrades to
 * `IssueImportUnavailableError` (ADR-0005) rather than guessing.
 */

interface Seen {
  readonly url: string
  readonly authorization: string | undefined
  readonly accept: string | undefined
}

/** A fake fetch returning `body` at `status`, capturing each call. */
function jsonFetch(status: number, body: unknown, seen: Seen[]): typeof fetch {
  return ((url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    seen.push({ url, authorization: headers.authorization, accept: headers.accept })
    return Promise.resolve(new Response(JSON.stringify(body), { status }))
  }) as unknown as typeof fetch
}

/** A fake fetch returning a raw (possibly non-JSON) body string. */
function rawFetch(status: number, raw: string): typeof fetch {
  return () => Promise.resolve(new Response(raw, { status }))
}

const alwaysToken = (token: string | null) => () => Promise.resolve(token)

describe('GithubImport.available', () => {
  it('True_WhenAccessTokenResolvesAString', async () => {
    const gh = new GithubImport({
      accessToken: alwaysToken('AT'),
      fetchImpl: jsonFetch(200, [], []),
    })
    expect(await gh.available()).toBe(true)
  })

  it('False_WhenAccessTokenResolvesNull', async () => {
    const gh = new GithubImport({
      accessToken: alwaysToken(null),
      fetchImpl: jsonFetch(200, [], []),
    })
    expect(await gh.available()).toBe(false)
  })

  it('False_WhenAccessTokenThrows', async () => {
    const gh = new GithubImport({
      accessToken: () => Promise.reject(new Error('vault down')),
      fetchImpl: jsonFetch(200, [], []),
    })
    expect(await gh.available()).toBe(false)
  })
})

describe('GithubImport.listIssues mapping', () => {
  it('MapsAssignedIssues_ToExternalIssue', async () => {
    const gh = new GithubImport({
      accessToken: alwaysToken('AT'),
      fetchImpl: jsonFetch(
        200,
        [
          {
            id: 101,
            number: 7,
            title: 'Fix the exporter',
            state: 'open',
            html_url: 'https://github.com/acme/app/issues/7',
            labels: [{ name: 'bug' }, 'urgent'],
            assignee: { login: 'octocat' },
            updated_at: '2026-07-02T09:00:00.000Z',
            repository: { full_name: 'acme/app' },
          },
        ],
        [],
      ),
    })

    const issues = await gh.listIssues({ state: 'open' })
    expect(issues).toEqual([
      {
        source: 'github',
        externalId: '101',
        key: 'acme/app#7',
        title: 'Fix the exporter',
        state: 'open',
        url: 'https://github.com/acme/app/issues/7',
        labels: ['bug', 'urgent'],
        assignee: 'octocat',
        updatedAtMs: Date.parse('2026-07-02T09:00:00.000Z'),
      },
    ])
  })

  it('FallsBackTitleToKey_AndOmitsAssigneeWhenAbsent', async () => {
    const gh = new GithubImport({
      accessToken: alwaysToken('AT'),
      fetchImpl: jsonFetch(
        200,
        [
          {
            id: 5,
            number: 3,
            title: '   ',
            state: 'closed',
            html_url: 'https://github.com/acme/app/issues/3',
            labels: [],
            assignee: null,
            updated_at: '2026-07-01T00:00:00.000Z',
            repository: { full_name: 'acme/app' },
          },
        ],
        [],
      ),
    })
    const [issue] = await gh.listIssues({ state: 'all' })
    expect(issue?.title).toBe('acme/app#3')
    expect(issue?.state).toBe('closed')
    expect(issue).not.toHaveProperty('assignee')
  })

  it('SkipsPullRequests_AndMalformedItems', async () => {
    const gh = new GithubImport({
      accessToken: alwaysToken('AT'),
      fetchImpl: jsonFetch(
        200,
        [
          {
            id: 1,
            number: 1,
            title: 'A PR, not an issue',
            state: 'open',
            html_url: 'https://github.com/acme/app/pull/1',
            labels: [],
            updated_at: '2026-07-02T09:00:00.000Z',
            repository: { full_name: 'acme/app' },
            pull_request: { url: 'https://api.github.com/…' },
          },
          {
            // no repository → cannot build the key → skipped
            id: 2,
            number: 2,
            title: 'orphan',
            state: 'open',
            html_url: 'https://github.com/x',
            labels: [],
            updated_at: '2026-07-02T09:00:00.000Z',
          },
          {
            id: 3,
            number: 9,
            title: 'Kept',
            state: 'open',
            html_url: 'https://github.com/acme/app/issues/9',
            labels: [],
            updated_at: '2026-07-02T09:00:00.000Z',
            repository: { full_name: 'acme/app' },
          },
        ],
        [],
      ),
    })
    const issues = await gh.listIssues({ state: 'open' })
    expect(issues.map(i => i.key)).toEqual(['acme/app#9'])
  })
})

describe('GithubImport.listIssues request shape', () => {
  it('HitsIssuesEndpoint_WithAssignedFilterStateAndBearerAndGithubAccept', async () => {
    const seen: Seen[] = []
    const gh = new GithubImport({
      accessToken: alwaysToken('secret'),
      fetchImpl: jsonFetch(200, [], seen),
    })

    await gh.listIssues({ state: 'all' })

    expect(seen).toHaveLength(1)
    const url = new URL(seen[0]!.url)
    expect(`${url.origin}${url.pathname}`).toBe('https://api.github.com/issues')
    expect(url.searchParams.get('filter')).toBe('assigned')
    expect(url.searchParams.get('state')).toBe('all')
    expect(seen[0]!.authorization).toBe('Bearer secret')
    expect(seen[0]!.accept).toBe('application/vnd.github+json')
  })

  it('DefaultsStateToOpen', async () => {
    const seen: Seen[] = []
    const gh = new GithubImport({
      accessToken: alwaysToken('AT'),
      fetchImpl: jsonFetch(200, [], seen),
    })
    await gh.listIssues({})
    expect(new URL(seen[0]!.url).searchParams.get('state')).toBe('open')
  })

  it('EmptyList_ReturnsEmptyArray', async () => {
    const gh = new GithubImport({
      accessToken: alwaysToken('AT'),
      fetchImpl: jsonFetch(200, [], []),
    })
    await expect(gh.listIssues({ state: 'open' })).resolves.toEqual([])
  })
})

describe('GithubImport.listIssues failures degrade to IssueImportUnavailableError', () => {
  it('NoLiveToken_Throws', async () => {
    const gh = new GithubImport({
      accessToken: alwaysToken(null),
      fetchImpl: jsonFetch(200, [], []),
    })
    await expect(gh.listIssues({ state: 'open' })).rejects.toBeInstanceOf(
      IssueImportUnavailableError,
    )
    await expect(gh.listIssues({ state: 'open' })).rejects.toMatchObject({ provider: 'github' })
  })

  it('TokenLookupThrows_Throws', async () => {
    const gh = new GithubImport({
      accessToken: () => Promise.reject(new Error('vault down')),
      fetchImpl: jsonFetch(200, [], []),
    })
    await expect(gh.listIssues({ state: 'open' })).rejects.toBeInstanceOf(
      IssueImportUnavailableError,
    )
  })

  it('NonOkResponse_Throws', async () => {
    const gh = new GithubImport({
      accessToken: alwaysToken('AT'),
      fetchImpl: jsonFetch(401, { message: 'Bad credentials' }, []),
    })
    await expect(gh.listIssues({ state: 'open' })).rejects.toBeInstanceOf(
      IssueImportUnavailableError,
    )
    await expect(gh.listIssues({ state: 'open' })).rejects.toThrow(/401/)
  })

  it('MalformedJson_Throws', async () => {
    const gh = new GithubImport({
      accessToken: alwaysToken('AT'),
      fetchImpl: rawFetch(200, 'not-json'),
    })
    await expect(gh.listIssues({ state: 'open' })).rejects.toBeInstanceOf(
      IssueImportUnavailableError,
    )
  })

  it('NetworkError_Throws', async () => {
    const gh = new GithubImport({
      accessToken: alwaysToken('AT'),
      fetchImpl: () => Promise.reject(new Error('ECONNRESET')),
    })
    await expect(gh.listIssues({ state: 'open' })).rejects.toBeInstanceOf(
      IssueImportUnavailableError,
    )
  })
})
