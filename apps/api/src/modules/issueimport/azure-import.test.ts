import { describe, expect, it } from 'vitest'
import { AzureImport } from './azure-import.js'
import { IssueImportUnavailableError } from './port.js'

/**
 * The live Azure DevOps Work Items adapter — proven entirely against a fake fetch, no network.
 * Confirms the two-step flow (WIQL POST → work-items batch GET), the `{project}/{id}` key and edit
 * URL, the state mapping (Closed/Done/Removed → `closed`), the request shapes (endpoints, bearer
 * auth, WIQL body), the empty-result short-circuit, and that every failure degrades to
 * `IssueImportUnavailableError` (ADR-0005).
 */

interface Seen {
  readonly url: string
  readonly method: string | undefined
  readonly authorization: string | undefined
  readonly body: string | undefined
}

/** A fake fetch returning `responses` in call order (each `{status, body}`), capturing each call. */
function sequencedFetch(
  responses: readonly { readonly status?: number; readonly body: unknown }[],
  seen: Seen[],
): typeof fetch {
  let call = 0
  return ((url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    seen.push({
      url,
      method: init?.method,
      authorization: headers.authorization,
      body: typeof init?.body === 'string' ? init.body : undefined,
    })
    const r = responses[Math.min(call, responses.length - 1)]
    call += 1
    return Promise.resolve(
      new Response(JSON.stringify(r?.body ?? {}), { status: r?.status ?? 200 }),
    )
  }) as unknown as typeof fetch
}

const alwaysToken = (token: string | null) => () => Promise.resolve(token)

/** Parse a captured WIQL request body's `query` string. */
function wiqlQuery(body: string | undefined): string {
  const parsed = JSON.parse(body ?? '{}') as { query?: string }
  return parsed.query ?? ''
}

const deps = (fetchImpl: typeof fetch, token: string | null = 'AT') => ({
  org: 'acme',
  project: 'Platform',
  accessToken: alwaysToken(token),
  fetchImpl,
})

describe('AzureImport.available', () => {
  it('True_WhenAccessTokenResolvesAString', async () => {
    expect(await new AzureImport(deps(sequencedFetch([], []))).available()).toBe(true)
  })
  it('False_WhenAccessTokenResolvesNull', async () => {
    expect(await new AzureImport(deps(sequencedFetch([], []), null)).available()).toBe(false)
  })
  it('False_WhenAccessTokenThrows', async () => {
    const az = new AzureImport({
      org: 'acme',
      project: 'Platform',
      accessToken: () => Promise.reject(new Error('vault down')),
      fetchImpl: sequencedFetch([], []),
    })
    expect(await az.available()).toBe(false)
  })
})

describe('AzureImport.listIssues mapping', () => {
  it('RunsWiqlThenBatch_AndMapsWorkItems', async () => {
    const seen: Seen[] = []
    const az = new AzureImport(
      deps(
        sequencedFetch(
          [
            { body: { workItems: [{ id: 42 }, { id: 43 }] } },
            {
              body: {
                value: [
                  {
                    id: 42,
                    fields: {
                      'System.Title': 'Ship the report',
                      'System.State': 'Active',
                      'System.ChangedDate': '2026-07-02T09:00:00.000Z',
                      'System.AssignedTo': { displayName: 'Dev One' },
                    },
                  },
                  {
                    id: 43,
                    fields: {
                      'System.Title': 'Old bug',
                      'System.State': 'Closed',
                      'System.ChangedDate': '2026-07-01T00:00:00.000Z',
                    },
                  },
                ],
              },
            },
          ],
          seen,
        ),
      ),
    )

    const issues = await az.listIssues({ state: 'all' })
    expect(issues).toEqual([
      {
        source: 'azure-devops',
        externalId: '42',
        key: 'Platform/42',
        title: 'Ship the report',
        state: 'open',
        url: 'https://dev.azure.com/acme/Platform/_workitems/edit/42',
        labels: [],
        assignee: 'Dev One',
        updatedAtMs: Date.parse('2026-07-02T09:00:00.000Z'),
      },
      {
        source: 'azure-devops',
        externalId: '43',
        key: 'Platform/43',
        title: 'Old bug',
        state: 'closed',
        url: 'https://dev.azure.com/acme/Platform/_workitems/edit/43',
        labels: [],
        updatedAtMs: Date.parse('2026-07-01T00:00:00.000Z'),
      },
    ])
  })

  it('FallsBackTitleToKey_WhenTitleMissing', async () => {
    const az = new AzureImport(
      deps(
        sequencedFetch(
          [
            { body: { workItems: [{ id: 7 }] } },
            { body: { value: [{ id: 7, fields: { 'System.State': 'New' } }] } },
          ],
          [],
        ),
      ),
    )
    const [issue] = await az.listIssues({ state: 'open' })
    expect(issue?.title).toBe('Platform/7')
    expect(issue?.state).toBe('open')
  })

  it('EmptyWiql_ShortCircuits_NoBatchCall', async () => {
    const seen: Seen[] = []
    const az = new AzureImport(deps(sequencedFetch([{ body: { workItems: [] } }], seen)))
    await expect(az.listIssues({ state: 'open' })).resolves.toEqual([])
    expect(seen).toHaveLength(1)
  })
})

describe('AzureImport.listIssues request shape', () => {
  it('WiqlPost_ThenBatchGet_WithBearerAndParams', async () => {
    const seen: Seen[] = []
    const az = new AzureImport(
      deps(
        sequencedFetch([{ body: { workItems: [{ id: 42 }] } }, { body: { value: [] } }], seen),
        'secret',
      ),
    )
    await az.listIssues({ state: 'open' })

    expect(seen).toHaveLength(2)
    // WIQL POST
    const wiql = new URL(seen[0]!.url)
    expect(`${wiql.origin}${wiql.pathname}`).toBe(
      'https://dev.azure.com/acme/Platform/_apis/wit/wiql',
    )
    expect(wiql.searchParams.get('api-version')).toBe('7.0')
    expect(seen[0]!.method).toBe('POST')
    expect(seen[0]!.authorization).toBe('Bearer secret')
    expect(wiqlQuery(seen[0]!.body)).toContain('@Me')
    // Batch GET
    const batch = new URL(seen[1]!.url)
    expect(`${batch.origin}${batch.pathname}`).toBe(
      'https://dev.azure.com/acme/Platform/_apis/wit/workitems',
    )
    expect(batch.searchParams.get('ids')).toBe('42')
    expect(batch.searchParams.get('fields')).toContain('System.Title')
    expect(batch.searchParams.get('api-version')).toBe('7.0')
    expect(seen[1]!.authorization).toBe('Bearer secret')
  })

  it('OpenState_FiltersClosedInTheWiql; AllState_DoesNot', async () => {
    const openSeen: Seen[] = []
    await new AzureImport(deps(sequencedFetch([{ body: { workItems: [] } }], openSeen))).listIssues(
      {
        state: 'open',
      },
    )
    expect(wiqlQuery(openSeen[0]!.body)).toContain('NOT IN')

    const allSeen: Seen[] = []
    await new AzureImport(deps(sequencedFetch([{ body: { workItems: [] } }], allSeen))).listIssues({
      state: 'all',
    })
    expect(wiqlQuery(allSeen[0]!.body)).not.toContain('NOT IN')
  })
})

describe('AzureImport.listIssues failures degrade to IssueImportUnavailableError', () => {
  it('NoLiveToken_Throws', async () => {
    const az = new AzureImport(deps(sequencedFetch([], []), null))
    await expect(az.listIssues({ state: 'open' })).rejects.toBeInstanceOf(
      IssueImportUnavailableError,
    )
    await expect(az.listIssues({ state: 'open' })).rejects.toMatchObject({
      provider: 'azure-devops',
    })
  })

  it('WiqlNonOk_Throws', async () => {
    const az = new AzureImport(deps(sequencedFetch([{ status: 401, body: {} }], [])))
    await expect(az.listIssues({ state: 'open' })).rejects.toBeInstanceOf(
      IssueImportUnavailableError,
    )
    await expect(az.listIssues({ state: 'open' })).rejects.toThrow(/401/)
  })

  it('BatchNonOk_Throws', async () => {
    const az = new AzureImport(
      deps(sequencedFetch([{ body: { workItems: [{ id: 1 }] } }, { status: 500, body: {} }], [])),
    )
    await expect(az.listIssues({ state: 'open' })).rejects.toBeInstanceOf(
      IssueImportUnavailableError,
    )
    await expect(az.listIssues({ state: 'open' })).rejects.toThrow(/500/)
  })

  it('NetworkError_Throws', async () => {
    const az = new AzureImport({
      org: 'acme',
      project: 'Platform',
      accessToken: alwaysToken('AT'),
      fetchImpl: () => Promise.reject(new Error('ECONNRESET')),
    })
    await expect(az.listIssues({ state: 'open' })).rejects.toBeInstanceOf(
      IssueImportUnavailableError,
    )
  })

  it('MalformedWiqlJson_Throws', async () => {
    const raw: typeof fetch = () => Promise.resolve(new Response('not-json', { status: 200 }))
    const az = new AzureImport({
      org: 'acme',
      project: 'Platform',
      accessToken: alwaysToken('AT'),
      fetchImpl: raw,
    })
    await expect(az.listIssues({ state: 'open' })).rejects.toBeInstanceOf(
      IssueImportUnavailableError,
    )
  })
})
