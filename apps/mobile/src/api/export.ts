import { getJson, postJson } from './http.js'
import { z } from 'zod'

/**
 * The dev-tool export client (REQ-035, #44 · ADR-0035/0005). Pushes the insight/action items the
 * user CONFIRMED in the preview to a dev tool (Jira/Linear/Slack) through the backend's narrow
 * `ExportTargetPort`, **confirmed-only and idempotently** — posting an item IS its confirmation and
 * a stable `dedupeKey` keeps a re-run from double-posting (the server's ledger holds the seen-set).
 *
 * The client never claims a post that did not happen: every item comes back with an honest
 * `outcome` the UI must show as-is — `sent` (with the created item's external id/url), `duplicate`
 * (already exported), `unavailable` (the target is not configured in this deployment — the backend's
 * `NullExportTarget` degrades gracefully, ADR-0005), or `failed`. Every field the API omits or
 * garbles is defaulted here so the UI never sees `undefined`, and an unrecognised outcome degrades
 * to `failed` (an honest error, never a fake success).
 */
export const exportOutcomeSchema = z
  .enum(['sent', 'unconfirmed', 'duplicate', 'unavailable', 'failed'])
  .catch('failed')
export type ExportOutcome = z.infer<typeof exportOutcomeSchema>

/** The dev tools the client can target (the backend also honours these names in `POST /run`). */
export const exportTargetNameSchema = z.enum(['jira', 'linear', 'slack'])
export type ExportTargetName = z.infer<typeof exportTargetNameSchema>

/** The created item's coordinates in the target tool, when a send actually landed. */
export const exportResultSchema = z.object({
  ok: z.boolean().catch(false),
  externalId: z.string().optional(),
  url: z.string().optional(),
  error: z.string().optional(),
})
export type ExportResult = z.infer<typeof exportResultSchema>

/** One item's recorded outcome from a run (`POST /run`) — the honest verdict per confirmed item. */
export const exportRunRecordSchema = z.object({
  dedupeKey: z.string().catch(''),
  outcome: exportOutcomeSchema,
  result: exportResultSchema.optional().catch(undefined),
})
export type ExportRunRecord = z.infer<typeof exportRunRecordSchema>

/** The `POST /run` response: the target, how many actually sent, and a record per item. */
export const exportRunResponseSchema = z.object({
  target: z.string().catch(''),
  sentCount: z.number().catch(0),
  records: z.array(exportRunRecordSchema).catch([]),
})
export type ExportRunResponse = z.infer<typeof exportRunResponseSchema>

/** One persisted ledger row (`GET /records`): the auditable proof of where an item landed. */
export const exportLedgerRecordSchema = z.object({
  id: z.string().catch(''),
  target: z.string().catch(''),
  dedupeKey: z.string().catch(''),
  status: exportOutcomeSchema,
  externalId: z.string().nullable().catch(null),
  url: z.string().nullable().catch(null),
  itemLabel: z.string().catch(''),
  createdAt: z.string().catch(''),
})
export type ExportLedgerRecord = z.infer<typeof exportLedgerRecordSchema>

/** One confirmed thing to export. `dedupeKey` is the stable idempotency handle (per ADR-0035). */
export interface ExportRunItem {
  /** Stable key identifying this item across runs (e.g. `meeting:<id>:action:<n>`). */
  readonly dedupeKey: string
  /** The wire `label` the backend maps to the target's title. */
  readonly label: string
  /** Optional body/description forwarded to the target tool. */
  readonly payload?: string
}

/** The export request: a destination tool and the confirmed items to push (min one, per DTO). */
export interface ExportRunInput {
  readonly target: ExportTargetName
  readonly items: readonly ExportRunItem[]
}

export function parseExportRecords(value: unknown): ExportLedgerRecord[] {
  return z.array(exportLedgerRecordSchema).catch([]).parse(value)
}

export function parseExportRunResponse(value: unknown): ExportRunResponse {
  return exportRunResponseSchema.parse(value)
}

/** The caller's own export ledger, newest first (read-only — nothing is posted). */
export async function fetchExportRecords(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExportLedgerRecord[]> {
  return parseExportRecords(await getJson(baseUrl, '/api/ai/export/records', fetchImpl))
}

/** Run an export of the confirmed items; the server's ledger keeps a re-run from double-posting. */
export async function runExport(
  baseUrl: string,
  input: ExportRunInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ExportRunResponse> {
  return parseExportRunResponse(await postJson(baseUrl, '/api/ai/export/run', input, fetchImpl))
}
