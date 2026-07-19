/**
 * Issue/ticket import core (GitHub Issues + Azure DevOps Work Items → candidate tasks) —
 * pure and side-effect-free (ADR-0005). The trackers are volatile vendors reached through a
 * narrow port; whatever adapter fetches them, the tickets arrive here as neutral `ExternalIssue`s
 * and this core decides, deterministically, which ones the import *proposes* as tasks. It
 * **never writes**: like every external source (ADR-0005), an import yields a queue of
 * `CandidateTaskProposal`s the user confirms — an imported ticket becomes a candidate task to
 * accept (`confirmed: false`, `import:<source>` provenance), never an auto-created entry. The
 * import is keyed on `externalKey` so the same ticket is proposed once — deduped both against
 * what was already imported and against duplicates inside the same batch.
 */

/** Where a ticket originates. */
export type IssueSource = 'github' | 'azure-devops'

/** A ticket as it comes from a tracker (via the adapter) — only these neutral fields. */
export interface ExternalIssue {
  readonly source: IssueSource
  /** Stable provider-internal id (e.g. GitHub node id, Azure work-item id). */
  readonly externalId: string
  /** Human-readable ref, e.g. `owner/repo#123` or `Proj/42` — the dedup key. */
  readonly key: string
  readonly title: string
  readonly state: 'open' | 'closed'
  readonly url: string
  readonly labels: readonly string[]
  readonly assignee?: string
  /** Provider "last updated" epoch ms — the deterministic sort input (never a clock read). */
  readonly updatedAtMs: number
}

/** A candidate task **proposal** — never created until the user confirms it (ADR-0005). */
export interface CandidateTaskProposal {
  /** The ticket's human ref it was imported from (`ExternalIssue.key`). */
  readonly externalKey: string
  readonly source: IssueSource
  readonly title: string
  /** Provenance: this came from a tracker import, the user decides (ADR-0005). */
  readonly provenance: 'import:github' | 'import:azure-devops'
  /** Always false here — the core proposes, it never creates. */
  readonly confirmed: false
  readonly labels: readonly string[]
  readonly url: string
}

export interface ImportOptions {
  /** Include `closed` tickets too; by default only `open` ones are proposed. */
  readonly includeClosed?: boolean
}

function provenanceFor(source: IssueSource): CandidateTaskProposal['provenance'] {
  return source === 'github' ? 'import:github' : 'import:azure-devops'
}

/**
 * Map external tickets to candidate task proposals — deterministic, keyed on `key`. Skips
 * `closed` tickets unless `opts.includeClosed`; dedups each key against `alreadyImportedKeys`
 * **and** against earlier duplicates in the same batch (first occurrence wins). Titles are
 * trimmed; an empty title falls back to the ticket key. Results are ordered by `updatedAtMs`
 * descending, ties broken by `externalKey` ascending, so the same input always yields the same
 * order. Nothing is created — every result is a proposal (`confirmed: false`).
 */
export function toTaskProposals(
  issues: readonly ExternalIssue[],
  alreadyImportedKeys: readonly string[],
  opts?: ImportOptions,
): CandidateTaskProposal[] {
  const includeClosed = opts?.includeClosed ?? false
  const seen = new Set<string>(alreadyImportedKeys)

  const selected = issues.filter(issue => {
    if (issue.state === 'closed' && !includeClosed) return false
    if (seen.has(issue.key)) return false
    seen.add(issue.key)
    return true
  })

  selected.sort((a, b) => {
    if (b.updatedAtMs !== a.updatedAtMs) return b.updatedAtMs - a.updatedAtMs
    // Keys are unique post-dedup, so a strict less-than fully orders the ties.
    return a.key < b.key ? -1 : 1
  })

  return selected.map(issue => {
    const trimmed = issue.title.trim()
    return {
      externalKey: issue.key,
      source: issue.source,
      title: trimmed.length > 0 ? trimmed : issue.key,
      provenance: provenanceFor(issue.source),
      confirmed: false,
      labels: issue.labels,
      url: issue.url,
    }
  })
}
