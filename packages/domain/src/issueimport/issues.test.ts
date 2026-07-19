import { describe, expect, it } from 'vitest'
import { toTaskProposals, type CandidateTaskProposal, type ExternalIssue } from './issues.js'

const T0 = 1_700_000_000_000

const issue = (over: Partial<ExternalIssue> & Pick<ExternalIssue, 'key'>): ExternalIssue => ({
  source: 'github',
  externalId: `id-${over.key}`,
  title: `Title ${over.key}`,
  state: 'open',
  url: `https://example.test/${over.key}`,
  labels: [],
  updatedAtMs: T0,
  ...over,
})

describe('toTaskProposals', () => {
  it('OpenIssue_MapsToConfirmedFalseProposalWithImportProvenance', () => {
    const [p] = toTaskProposals(
      [
        issue({
          source: 'github',
          key: 'owner/repo#1',
          title: 'Fix login',
          url: 'https://github.test/owner/repo/issues/1',
          labels: ['bug', 'p1'],
          assignee: 'alice',
        }),
      ],
      [],
    )
    const expected: CandidateTaskProposal = {
      externalKey: 'owner/repo#1',
      source: 'github',
      title: 'Fix login',
      provenance: 'import:github',
      confirmed: false,
      labels: ['bug', 'p1'],
      url: 'https://github.test/owner/repo/issues/1',
    }
    expect(p).toEqual(expected)
  })

  it('AzureDevOpsSource_UsesImportAzureDevOpsProvenance', () => {
    const [p] = toTaskProposals([issue({ source: 'azure-devops', key: 'Proj/42' })], [])
    expect(p?.provenance).toBe('import:azure-devops')
    expect(p?.source).toBe('azure-devops')
  })

  it('AlreadyImportedKey_IsDeduped', () => {
    const proposals = toTaskProposals(
      [issue({ key: 'owner/repo#1' }), issue({ key: 'owner/repo#2' })],
      ['owner/repo#1'],
    )
    expect(proposals.map(p => p.externalKey)).toEqual(['owner/repo#2'])
  })

  it('DuplicateKeysInSameBatch_KeepFirstOccurrenceOnly', () => {
    const proposals = toTaskProposals(
      [
        issue({ key: 'owner/repo#1', title: 'First', updatedAtMs: T0 }),
        issue({ key: 'owner/repo#1', title: 'Second', updatedAtMs: T0 }),
      ],
      [],
    )
    expect(proposals).toHaveLength(1)
    expect(proposals[0]?.title).toBe('First')
  })

  it('ClosedIssue_IsSkippedByDefault', () => {
    const proposals = toTaskProposals([issue({ key: 'owner/repo#9', state: 'closed' })], [])
    expect(proposals).toEqual([])
  })

  it('ClosedIssue_IsIncludedWhenIncludeClosed', () => {
    const proposals = toTaskProposals([issue({ key: 'owner/repo#9', state: 'closed' })], [], {
      includeClosed: true,
    })
    expect(proposals.map(p => p.externalKey)).toEqual(['owner/repo#9'])
  })

  it('Ordering_ByUpdatedAtDescThenKeyAsc', () => {
    const proposals = toTaskProposals(
      [
        issue({ key: 'b', updatedAtMs: T0 + 1000 }),
        issue({ key: 'a', updatedAtMs: T0 + 2000 }),
        issue({ key: 'c', updatedAtMs: T0 + 1000 }),
      ],
      [],
    )
    // newest first (a), then the T0+1000 tie broken by key asc (b before c).
    expect(proposals.map(p => p.externalKey)).toEqual(['a', 'b', 'c'])
  })

  it('EmptyOrWhitespaceTitle_FallsBackToKey', () => {
    const proposals = toTaskProposals(
      [issue({ key: 'owner/repo#7', title: '   ' }), issue({ key: 'owner/repo#8', title: '' })],
      [],
    )
    const byKey = new Map(proposals.map(p => [p.externalKey, p.title]))
    expect(byKey.get('owner/repo#7')).toBe('owner/repo#7')
    expect(byKey.get('owner/repo#8')).toBe('owner/repo#8')
  })

  it('Title_IsTrimmed', () => {
    const [p] = toTaskProposals([issue({ key: 'k', title: '  Fix bug  ' })], [])
    expect(p?.title).toBe('Fix bug')
  })

  it('EmptyInput_YieldsEmpty', () => {
    expect(toTaskProposals([], [])).toEqual([])
    expect(toTaskProposals([], ['x'], { includeClosed: true })).toEqual([])
  })

  it('DoesNotMutateInput', () => {
    const input = [
      issue({ key: 'b', updatedAtMs: T0 + 1000 }),
      issue({ key: 'a', updatedAtMs: T0 + 2000 }),
    ]
    const before = input.map(i => i.key)
    toTaskProposals(input, [])
    expect(input.map(i => i.key)).toEqual(before)
  })
})
