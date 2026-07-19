import { getJson, postJson } from './http.js'
import { z } from 'zod'

/**
 * The issue/ticket import preview client (M3, ADR-0005). The backend fetches issues
 * from a connected GitHub / Azure DevOps connector through its narrow port and returns
 * **proposals** only — `CandidateTaskProposal`s the user reviews and confirms; nothing is
 * created here (`confirmed: false` always). An honest `status` says why the list is empty
 * (`no-consent` / `unavailable`), and a hard refusal (not consented / not connected / not an
 * issues connector) arrives as a **409** that `getJson` surfaces as an `ApiError` for the
 * caller to show. Every field the API omits or garbles is defaulted here so the UI never
 * sees `undefined`.
 */
export const issueSourceSchema = z.enum(['github', 'azure-devops']).catch('github')
export type IssueSource = z.infer<typeof issueSourceSchema>

export const issueProvenanceSchema = z
  .enum(['import:github', 'import:azure-devops'])
  .catch('import:github')
export type IssueProvenance = z.infer<typeof issueProvenanceSchema>

export const candidateTaskProposalSchema = z.object({
  externalKey: z.string().catch(''),
  source: issueSourceSchema,
  title: z.string().catch(''),
  provenance: issueProvenanceSchema,
  // Proposals are never pre-confirmed (ADR-0005): the create is the user's own action.
  confirmed: z.literal(false).catch(false),
  labels: z.array(z.string()).catch([]).default([]),
  url: z.string().catch(''),
})
export type CandidateTaskProposal = z.infer<typeof candidateTaskProposalSchema>

export const issueImportPreviewSchema = z.object({
  proposals: z.array(candidateTaskProposalSchema).catch([]).default([]),
  status: z.enum(['ok', 'unavailable', 'no-consent']).catch('ok'),
})
export type IssueImportPreview = z.infer<typeof issueImportPreviewSchema>

export function parseIssueImportPreview(value: unknown): IssueImportPreview {
  return issueImportPreviewSchema.parse(value)
}

/** Optional preview filter; the backend defaults to open issues when `state` is omitted. */
export interface IssuePreviewOptions {
  readonly state?: 'open' | 'closed' | 'all'
}

/**
 * Preview the issues a connected issues connector would import as tasks
 * (`GET /api/connectors/:id/issues/preview`). Returns proposals + an honest status; a
 * connector that is not consented / not connected / not an issues connector answers **409**,
 * which propagates as an `ApiError` carrying the server's honest `detail`.
 */
export async function previewIssueImport(
  baseUrl: string,
  connectorId: string,
  opts: IssuePreviewOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<IssueImportPreview> {
  const params = new URLSearchParams()
  if (opts.state !== undefined) params.set('state', opts.state)
  const qs = params.toString()
  const base = `/api/connectors/${connectorId}/issues/preview`
  const path = qs.length > 0 ? `${base}?${qs}` : base
  return parseIssueImportPreview(await getJson(baseUrl, path, fetchImpl))
}

/** One imported-ticket link to record: the ticket ref and, when created, its task id. */
export interface ImportedIssueLink {
  readonly externalKey: string
  readonly taskId?: string
}

export const recordImportedResultSchema = z.object({ recorded: z.number().catch(0).default(0) })
export type RecordImportedResult = z.infer<typeof recordImportedResultSchema>

/**
 * Record the tickets just imported (`POST /api/connectors/:id/issues/import`, REQ-066) so the next
 * preview no longer re-proposes them. This records **link rows only** — the tasks were already
 * created via the tracking endpoint (ADR-0005). Returns how many links the server recorded.
 */
export async function recordImported(
  baseUrl: string,
  connectorId: string,
  items: readonly ImportedIssueLink[],
  fetchImpl: typeof fetch = fetch,
): Promise<RecordImportedResult> {
  const path = `/api/connectors/${connectorId}/issues/import`
  return recordImportedResultSchema.parse(await postJson(baseUrl, path, { items }, fetchImpl))
}
