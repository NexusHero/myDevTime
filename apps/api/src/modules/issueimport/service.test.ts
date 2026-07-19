import { describe, expect, it } from 'vitest'
import type { ExternalIssue } from '@mydevtime/domain'
import { GithubImport } from './github-import.js'
import { AzureImport } from './azure-import.js'
import { NullIssueImport } from './null-import.js'
import {
  IssueImportUnavailableError,
  type IssueImportPort,
  type ListIssuesOptions,
} from './port.js'
import { previewImport, providerForConnector, resolveIssueImportPort } from './service.js'

/**
 * The issue-import resolver + preview planner (ADR-0005): consent-gated, availability-gated, then
 * a deterministic mapping over `toTaskProposals`. Proves the connector→provider mapping, that a
 * provider missing its required config degrades to the Null adapter, and that the preview returns
 * proposals only — never a write — with an honest status.
 */

const token = () => Promise.resolve<string | null>('AT')

describe('providerForConnector', () => {
  it('MapsKnownIssueConnectors_ElseNull', () => {
    expect(providerForConnector('github')).toBe('github')
    expect(providerForConnector('azure-devops')).toBe('azure-devops')
    expect(providerForConnector('jira')).toBe('null')
    expect(providerForConnector('google-calendar')).toBe('null')
  })
})

describe('resolveIssueImportPort', () => {
  it('Github_WithToken_ResolvesGithub; WithoutToken_DegradesToNull', () => {
    expect(resolveIssueImportPort('github', { accessToken: token })).toBeInstanceOf(GithubImport)
    expect(resolveIssueImportPort('github', {})).toBeInstanceOf(NullIssueImport)
  })

  it('Azure_NeedsBothTokenAndOrgProject_ElseNull', () => {
    expect(
      resolveIssueImportPort('azure-devops', {
        accessToken: token,
        azure: { org: 'acme', project: 'P' },
      }),
    ).toBeInstanceOf(AzureImport)
    expect(resolveIssueImportPort('azure-devops', { accessToken: token })).toBeInstanceOf(
      NullIssueImport,
    )
    expect(
      resolveIssueImportPort('azure-devops', { azure: { org: 'acme', project: 'P' } }),
    ).toBeInstanceOf(NullIssueImport)
  })

  it('UnknownProvider_ResolvesNull', () => {
    expect(resolveIssueImportPort('null')).toBeInstanceOf(NullIssueImport)
  })
})

const issue = (over: Partial<ExternalIssue> = {}): ExternalIssue => ({
  source: 'github',
  externalId: '1',
  key: 'acme/app#1',
  title: 'Do the thing',
  state: 'open',
  url: 'https://github.com/acme/app/issues/1',
  labels: ['bug'],
  updatedAtMs: 1000,
  ...over,
})

/** A stub port returning fixed issues (or refusing) — the seam previewImport plans over. */
class StubPort implements IssueImportPort {
  readonly provider = 'github' as const
  constructor(
    private readonly issues: readonly ExternalIssue[],
    private readonly isAvailable = true,
  ) {}
  available(): Promise<boolean> {
    return Promise.resolve(this.isAvailable)
  }
  listIssues(_opts: ListIssuesOptions): Promise<readonly ExternalIssue[]> {
    return Promise.resolve(this.issues)
  }
}

describe('previewImport', () => {
  it('NoConsent_ReturnsEmptyNoConsent_WithoutTouchingTheProvider', async () => {
    const preview = await previewImport(new StubPort([issue()]), false)
    expect(preview).toEqual({ proposals: [], status: 'no-consent' })
  })

  it('Unavailable_ReturnsEmptyUnavailable', async () => {
    const preview = await previewImport(new NullIssueImport(), true)
    expect(preview).toEqual({ proposals: [], status: 'unavailable' })
  })

  it('MidListUnavailableError_DegradesToUnavailable', async () => {
    const port: IssueImportPort = {
      provider: 'github',
      available: () => Promise.resolve(true),
      listIssues: () => Promise.reject(new IssueImportUnavailableError('github')),
    }
    expect(await previewImport(port, true)).toEqual({ proposals: [], status: 'unavailable' })
  })

  it('Ok_MapsIssuesToProposals_NeverWrites', async () => {
    const preview = await previewImport(new StubPort([issue()]), true, { state: 'open' })
    expect(preview.status).toBe('ok')
    expect(preview.proposals).toEqual([
      {
        externalKey: 'acme/app#1',
        source: 'github',
        title: 'Do the thing',
        provenance: 'import:github',
        confirmed: false,
        labels: ['bug'],
        url: 'https://github.com/acme/app/issues/1',
      },
    ])
  })

  it('OpenState_FiltersClosed; AllState_IncludesClosed', async () => {
    const issues = [issue({ key: 'a#1' }), issue({ key: 'a#2', state: 'closed' })]
    const open = await previewImport(new StubPort(issues), true, { state: 'open' })
    expect(open.proposals.map(p => p.externalKey)).toEqual(['a#1'])
    const all = await previewImport(new StubPort(issues), true, { state: 'all' })
    expect(all.proposals.map(p => p.externalKey).sort()).toEqual(['a#1', 'a#2'])
  })
})
