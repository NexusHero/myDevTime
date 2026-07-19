import { z } from 'zod'
import type { ExternalIssue } from '@mydevtime/domain'
import {
  IssueImportUnavailableError,
  type IssueImportPort,
  type ListIssuesOptions,
} from './port.js'

/**
 * The live GitHub Issues adapter (ADR-0005; skill §2.2) — the ONE file that knows GitHub's issues
 * wire shape. Reads the caller's **assigned** issues via `GET /issues?filter=assigned&state=…`
 * (the authenticated user's cross-repository issue list) with a bearer token + the
 * `application/vnd.github+json` accept header, and translates each item into the neutral
 * `ExternalIssue` (`key = owner/repo#number`). Read-only by the port's contract — writing tasks is
 * a separate, confirm-gated surface that does not exist here. Auth is a function handed in by the
 * composition root (the connectors module's vault + refresh flow); this file never touches the
 * vault, the DB, or an env var. Every failure degrades to `IssueImportUnavailableError` (ADR-0005)
 * — the import proposes nothing rather than guessing. Pull requests (which GitHub returns from the
 * same endpoint) are skipped: only true issues become candidates.
 */

const ISSUES_ENDPOINT = 'https://api.github.com/issues'
const FETCH_TIMEOUT_MS = 10_000

// GitHub's wire shape (list issues assigned to the authenticated user), narrowed to what the port
// needs. Unknown keys are ignored; a malformed item is skipped, never guessed at.
const githubLabelSchema = z.union([z.string(), z.object({ name: z.string().optional() })])
const githubIssueSchema = z.object({
  id: z.number().optional(),
  number: z.number().optional(),
  title: z.string().optional(),
  state: z.string().optional(),
  html_url: z.string().optional(),
  labels: z.array(githubLabelSchema).default([]),
  assignee: z.object({ login: z.string().optional() }).nullish(),
  updated_at: z.string().optional(),
  repository: z.object({ full_name: z.string().optional() }).nullish(),
  // Present only when the item is actually a pull request — those are not issues.
  pull_request: z.object({}).nullish(),
})
const issuesResponseSchema = z.array(z.unknown())

type GithubIssue = z.infer<typeof githubIssueSchema>

function labelNames(labels: GithubIssue['labels']): string[] {
  const out: string[] = []
  for (const label of labels) {
    const name = typeof label === 'string' ? label : label.name
    if (name !== undefined && name.length > 0) out.push(name)
  }
  return out
}

function toExternalIssue(item: GithubIssue): ExternalIssue | null {
  // Skip pull requests: the assigned-issues endpoint mixes them in, but they are not issues.
  if (item.pull_request !== undefined && item.pull_request !== null) return null
  if (item.id === undefined || item.number === undefined) return null
  const fullName = item.repository?.full_name
  if (fullName === undefined || fullName.length === 0) return null
  if (item.html_url === undefined || item.html_url.length === 0) return null
  if (item.updated_at === undefined) return null
  const updatedAtMs = Date.parse(item.updated_at)
  if (Number.isNaN(updatedAtMs)) return null
  const state: ExternalIssue['state'] = item.state === 'closed' ? 'closed' : 'open'
  const title = item.title?.trim()
  const assignee = item.assignee?.login
  return {
    source: 'github',
    externalId: String(item.id),
    key: `${fullName}#${String(item.number)}`,
    title: title !== undefined && title.length > 0 ? title : `${fullName}#${String(item.number)}`,
    state,
    url: item.html_url,
    labels: labelNames(item.labels),
    ...(assignee !== undefined && assignee.length > 0 ? { assignee } : {}),
    updatedAtMs,
  }
}

export interface GithubImportDeps {
  /**
   * A live access token (the connectors module's vault + refresh flow), or `null` when the user is
   * not connected / the token cannot be refreshed.
   */
  readonly accessToken: () => Promise<string | null>
  readonly fetchImpl?: typeof fetch
}

export class GithubImport implements IssueImportPort {
  readonly provider = 'github' as const

  constructor(private readonly deps: GithubImportDeps) {}

  /** Available = a live token can be produced. No issue fetch happens here. */
  async available(): Promise<boolean> {
    try {
      return (await this.deps.accessToken()) !== null
    } catch {
      return false
    }
  }

  async listIssues(opts: ListIssuesOptions): Promise<readonly ExternalIssue[]> {
    let token: string | null
    try {
      token = await this.deps.accessToken()
    } catch {
      token = null
    }
    if (token === null) {
      throw new IssueImportUnavailableError('github', 'no live GitHub access token')
    }
    const fetchImpl = this.deps.fetchImpl ?? fetch
    const url = new URL(ISSUES_ENDPOINT)
    url.searchParams.set('filter', 'assigned')
    url.searchParams.set('state', opts.state === 'all' ? 'all' : 'open')

    let res: Response
    try {
      res = await fetchImpl(url.toString(), {
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
    } catch {
      throw new IssueImportUnavailableError('github', 'GitHub is unreachable')
    }
    if (!res.ok) {
      throw new IssueImportUnavailableError('github', `issues responded ${String(res.status)}`)
    }
    const parsed = issuesResponseSchema.safeParse(await res.json().catch(() => null))
    if (!parsed.success) {
      throw new IssueImportUnavailableError('github', 'unexpected issues response shape')
    }
    const issues: ExternalIssue[] = []
    for (const raw of parsed.data) {
      const item = githubIssueSchema.safeParse(raw)
      if (!item.success) continue
      const issue = toExternalIssue(item.data)
      if (issue !== null) issues.push(issue)
    }
    return issues
  }
}
