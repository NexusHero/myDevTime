import { deleteJson, getJson, putJson } from './http.js'
import { z } from 'zod'

/**
 * The connectors client (M3, ADR-0032/0033): the real state of each OAuth
 * integration — is it configured in this deployment, is the user connected (a
 * sealed token exists), and which capabilities they have consented to. Replaces the
 * old fake "Verbunden" toggle: an unconfigured provider is shown honestly as
 * "geplant", never as connected.
 */
export const capabilitySchema = z.enum(['inbound', 'outbound', 'capture'])
export type Capability = z.infer<typeof capabilitySchema>

export const capabilityStatusSchema = z.object({
  capability: capabilitySchema.catch('inbound'),
  label: z.string(),
  granted: z.boolean().default(false),
})
export type CapabilityStatus = z.infer<typeof capabilityStatusSchema>

export const connectorStatusSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.string(),
  configured: z.boolean().default(false),
  connected: z.boolean().default(false),
  capabilities: z.array(capabilityStatusSchema).catch([]).default([]),
})
export type ConnectorStatus = z.infer<typeof connectorStatusSchema>

export function parseConnector(value: unknown): ConnectorStatus {
  return connectorStatusSchema.parse(value)
}

/** List every connector's real state for the caller's workspace. */
export async function getConnectors(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectorStatus[]> {
  const res = await getJson(baseUrl, '/api/connectors', fetchImpl)
  return z.array(connectorStatusSchema).parse(res)
}

/** Set a single capability's consent for a connector; returns the fresh full list. */
export async function setConsent(
  baseUrl: string,
  id: string,
  capability: Capability,
  granted: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectorStatus[]> {
  const body = await putJson(
    baseUrl,
    `/api/connectors/${id}/consent`,
    { capability, granted },
    fetchImpl,
  )
  return z.array(connectorStatusSchema).parse(body)
}

/** Disconnect a connector: deletes sealed tokens + revokes consent server-side. */
export async function disconnectConnector(
  baseUrl: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectorStatus[]> {
  const res = await deleteJson(baseUrl, `/api/connectors/${id}`, fetchImpl)
  return z.array(connectorStatusSchema).parse(res)
}

/** The provider authorize URL the client opens to start the OAuth dance (REQ-010, #15). */
export const authorizeResultSchema = z.object({ url: z.string() })
export type AuthorizeResult = z.infer<typeof authorizeResultSchema>

/**
 * Start the OAuth flow for a connector: ask the backend for the provider authorize
 * URL (built from the scopes the user consented to, with a signed state). The client
 * opens the returned `url`. A deployment that hasn't configured this provider — or a
 * connector with no consent granted yet — answers **409**; `getJson` surfaces that as
 * an `ApiError` carrying the server's honest `detail`, which the caller must show
 * instead of faking a connection.
 */
export async function authorizeConnector(
  baseUrl: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthorizeResult> {
  const res = await getJson(baseUrl, `/api/connectors/${id}/authorize`, fetchImpl)
  return authorizeResultSchema.parse(res)
}

/**
 * The calendar import preview (REQ-010): the deterministic `planImport` proposal —
 * ghost blocks to confirm, never a write (ADR-0005). Mirrors the domain
 * `MergeProposal`/`MergeChange` shape the backend returns.
 */
export const calendarEventSchema = z.object({
  uid: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  title: z.string(),
})
export type CalendarEvent = z.infer<typeof calendarEventSchema>

export const importedBlockSchema = z.object({
  uid: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  title: z.string(),
})
export type ImportedBlock = z.infer<typeof importedBlockSchema>

export const mergeChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('new'), event: calendarEventSchema }),
  z.object({ kind: z.literal('changed'), event: calendarEventSchema, from: importedBlockSchema }),
])
export type MergeChange = z.infer<typeof mergeChangeSchema>

export const mergeProposalSchema = z.object({
  changes: z.array(mergeChangeSchema).catch([]).default([]),
  orphaned: z.array(importedBlockSchema).catch([]).default([]),
  unchangedCount: z.number().catch(0).default(0),
})
export type MergeProposal = z.infer<typeof mergeProposalSchema>

/** `planImport`'s result: the proposal plus an honest status when it's empty. */
export const calendarImportPlanSchema = z.object({
  proposal: mergeProposalSchema,
  status: z.enum(['ok', 'no-consent', 'unavailable']).catch('ok'),
})
export type CalendarImportPlan = z.infer<typeof calendarImportPlanSchema>

/** Optional preview window (ms epoch); the backend defaults to ±1 week when omitted. */
export interface CalendarPreviewRange {
  readonly fromMs?: number
  readonly toMs?: number
}

/**
 * Preview a Google Calendar import: the backend fetches the live window through the
 * narrow calendar port and diffs it deterministically, returning **proposals** only
 * (it writes nothing, ADR-0005). Refuses with **409** unless `inbound` consent is
 * granted AND a sealed token exists (consent-first, REQ-025) — that honest reason
 * arrives as an `ApiError` for the caller to surface.
 */
export async function previewCalendarImport(
  baseUrl: string,
  range: CalendarPreviewRange = {},
  fetchImpl: typeof fetch = fetch,
  connectorId = 'google-calendar',
): Promise<CalendarImportPlan> {
  const params = new URLSearchParams()
  if (range.fromMs !== undefined) params.set('fromMs', String(range.fromMs))
  if (range.toMs !== undefined) params.set('toMs', String(range.toMs))
  const qs = params.toString()
  // The backend exposes both `google-calendar/preview` and the generic `:id/preview` (same
  // consent-gated proposal, additive) — so any OAuth calendar connector (Google, Microsoft) previews
  // through the same client call.
  const base = `/api/connectors/${connectorId}/preview`
  const path = qs.length > 0 ? `${base}?${qs}` : base
  const res = await getJson(baseUrl, path, fetchImpl)
  return calendarImportPlanSchema.parse(res)
}
