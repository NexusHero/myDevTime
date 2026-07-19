import { z } from 'zod'
import type { ExternalIssue } from '@mydevtime/domain'
import {
  IssueImportUnavailableError,
  type IssueImportPort,
  type ListIssuesOptions,
} from './port.js'

/**
 * The live Azure DevOps Work Items adapter (ADR-0005; skill §2.2) — the ONE file that knows Azure
 * DevOps's wire shape. Two steps, both confined here: POST a WIQL query
 * (`…/_apis/wit/wiql`) to resolve the caller's assigned work-item ids, then GET the batch
 * (`…/_apis/wit/workitems?ids=…&fields=…`) and translate each into the neutral `ExternalIssue`
 * (`key = {project}/{id}`). Read-only by the port's contract. The bearer token is a function handed
 * in by the composition root (the connectors module's vault flow); `org`/`project` are config. This
 * file never touches the vault, the DB, or an env var. Every failure degrades to
 * `IssueImportUnavailableError` (ADR-0005). `System.ChangedDate` is requested alongside title/state
 * because `ExternalIssue.updatedAtMs` is a required deterministic sort input — fabricating it would
 * make ordering meaningless.
 */

const API_VERSION = '7.0'
const FETCH_TIMEOUT_MS = 10_000
/** Azure caps a work-items batch at 200 ids; take the most recent page. */
const MAX_IDS = 200
/** Azure states we treat as closed; everything else maps to `open`. */
const CLOSED_STATES = new Set(['Closed', 'Done', 'Removed'])

const WIQL_QUERY_OPEN =
  'SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me ' +
  "AND [System.State] NOT IN ('Closed', 'Done', 'Removed') ORDER BY [System.ChangedDate] DESC"
const WIQL_QUERY_ALL =
  'SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me ' +
  'ORDER BY [System.ChangedDate] DESC'

// Azure's wire shapes, narrowed to what the port needs. Unknown keys ignored; malformed skipped.
const wiqlResponseSchema = z.object({
  workItems: z.array(z.object({ id: z.number() })).default([]),
})
const workItemFieldsSchema = z.object({
  'System.Title': z.string().optional(),
  'System.State': z.string().optional(),
  'System.ChangedDate': z.string().optional(),
  'System.AssignedTo': z
    .union([z.string(), z.object({ displayName: z.string().optional() })])
    .nullish(),
})
const workItemSchema = z.object({
  id: z.number().optional(),
  fields: workItemFieldsSchema.optional(),
})
const workItemsBatchSchema = z.object({ value: z.array(z.unknown()).default([]) })

type WorkItem = z.infer<typeof workItemSchema>

export interface AzureImportDeps {
  /** The Azure DevOps organization slug (config, never source). */
  readonly org: string
  /** The Azure DevOps project name (config, never source). */
  readonly project: string
  /**
   * A live access token (the connectors module's vault flow — an OAuth bearer, or a PAT the
   * composition root sealed), or `null` when the user is not connected.
   */
  readonly accessToken: () => Promise<string | null>
  readonly fetchImpl?: typeof fetch
}

export class AzureImport implements IssueImportPort {
  readonly provider = 'azure-devops' as const

  constructor(private readonly deps: AzureImportDeps) {}

  private base(): string {
    return `https://dev.azure.com/${encodeURIComponent(this.deps.org)}/${encodeURIComponent(
      this.deps.project,
    )}`
  }

  private toExternalIssue(item: WorkItem): ExternalIssue | null {
    if (item.id === undefined) return null
    const fields = item.fields
    const state: ExternalIssue['state'] =
      fields?.['System.State'] !== undefined && CLOSED_STATES.has(fields['System.State'])
        ? 'closed'
        : 'open'
    const changed = fields?.['System.ChangedDate']
    const updatedAtMs = changed === undefined ? 0 : Date.parse(changed)
    const title = fields?.['System.Title']?.trim()
    const key = `${this.deps.project}/${String(item.id)}`
    const assigned = fields?.['System.AssignedTo']
    const assignee = typeof assigned === 'string' ? assigned : (assigned?.displayName ?? undefined)
    return {
      source: 'azure-devops',
      externalId: String(item.id),
      key,
      title: title !== undefined && title.length > 0 ? title : key,
      state,
      url: `${this.base()}/_workitems/edit/${String(item.id)}`,
      labels: [],
      ...(assignee !== undefined && assignee.length > 0 ? { assignee } : {}),
      updatedAtMs: Number.isNaN(updatedAtMs) ? 0 : updatedAtMs,
    }
  }

  /** Available = a live token can be produced. No work-item fetch happens here. */
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
      throw new IssueImportUnavailableError('azure-devops', 'no live Azure DevOps access token')
    }
    const fetchImpl = this.deps.fetchImpl ?? fetch
    const ids = await this.runWiql(fetchImpl, token, opts)
    if (ids.length === 0) return []
    return this.fetchBatch(fetchImpl, token, ids)
  }

  private async runWiql(
    fetchImpl: typeof fetch,
    token: string,
    opts: ListIssuesOptions,
  ): Promise<number[]> {
    const url = new URL(`${this.base()}/_apis/wit/wiql`)
    url.searchParams.set('api-version', API_VERSION)
    let res: Response
    try {
      res = await fetchImpl(url.toString(), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          query: opts.state === 'all' ? WIQL_QUERY_ALL : WIQL_QUERY_OPEN,
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
    } catch {
      throw new IssueImportUnavailableError('azure-devops', 'Azure DevOps is unreachable')
    }
    if (!res.ok) {
      throw new IssueImportUnavailableError('azure-devops', `wiql responded ${String(res.status)}`)
    }
    const parsed = wiqlResponseSchema.safeParse(await res.json().catch(() => null))
    if (!parsed.success) {
      throw new IssueImportUnavailableError('azure-devops', 'unexpected wiql response shape')
    }
    return parsed.data.workItems.slice(0, MAX_IDS).map(w => w.id)
  }

  private async fetchBatch(
    fetchImpl: typeof fetch,
    token: string,
    ids: readonly number[],
  ): Promise<readonly ExternalIssue[]> {
    const url = new URL(`${this.base()}/_apis/wit/workitems`)
    url.searchParams.set('ids', ids.join(','))
    url.searchParams.set('fields', 'System.Title,System.State,System.ChangedDate,System.AssignedTo')
    url.searchParams.set('api-version', API_VERSION)
    let res: Response
    try {
      res = await fetchImpl(url.toString(), {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
    } catch {
      throw new IssueImportUnavailableError('azure-devops', 'Azure DevOps is unreachable')
    }
    if (!res.ok) {
      throw new IssueImportUnavailableError(
        'azure-devops',
        `workitems responded ${String(res.status)}`,
      )
    }
    const parsed = workItemsBatchSchema.safeParse(await res.json().catch(() => null))
    if (!parsed.success) {
      throw new IssueImportUnavailableError('azure-devops', 'unexpected workitems response shape')
    }
    const issues: ExternalIssue[] = []
    for (const raw of parsed.data.value) {
      const item = workItemSchema.safeParse(raw)
      if (!item.success) continue
      const issue = this.toExternalIssue(item.data)
      if (issue !== null) issues.push(issue)
    }
    return issues
  }
}
