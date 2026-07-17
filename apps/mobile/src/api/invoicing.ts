import { deleteJson, getJson, postJson } from './http.js'
import { z } from 'zod'

/**
 * Client for the invoicing / "Abrechnung" endpoints (design v6, REQ-005/009).
 * Parsing is pure and tested; every amount stays exactly as the server's
 * deterministic core computed it (ADR-0005) — the client never re-derives money.
 */

export const clientOpenSchema = z.object({
  clientId: z.string(),
  openMs: z.number(),
  openMinor: z.number(),
})
export type ClientOpen = z.infer<typeof clientOpenSchema>

export const clientsOpenSchema = z.object({
  clients: z.array(clientOpenSchema),
  currencyCode: z.string(),
})
export type ClientsOpen = z.infer<typeof clientsOpenSchema>

export const agingKeySchema = z.enum(['recent', 'mid', 'old'])
export type AgingKey = z.infer<typeof agingKeySchema>

export const agingBucketDtoSchema = z.object({
  key: agingKeySchema,
  minor: z.number(),
  ms: z.number(),
})
export type AgingBucketDTO = z.infer<typeof agingBucketDtoSchema>

export const openAgingSchema = z.object({
  buckets: z.array(agingBucketDtoSchema),
  totalMinor: z.number(),
  totalMs: z.number(),
  currencyCode: z.string(),
})
export type OpenAging = z.infer<typeof openAgingSchema>

export const invoiceLineDtoSchema = z.object({
  entryId: z.string(),
  projectId: z.string(),
  taskId: z.string().nullable(),
  start: z.number(),
  durationMs: z.number(),
  amountMinor: z.number(),
  priced: z.boolean().catch(false),
  note: z.string().nullable(),
})
export type InvoiceLineDTO = z.infer<typeof invoiceLineDtoSchema>

export const invoicePreviewDtoSchema = z.object({
  lines: z.array(invoiceLineDtoSchema),
  currencyCode: z.string(),
})
export type InvoicePreviewDTO = z.infer<typeof invoicePreviewDtoSchema>

export const issuedInvoiceDtoSchema = z.object({
  id: z.string(),
  clientId: z.string().nullable(),
  periodStart: z.string(),
  periodEnd: z.string(),
  totalMs: z.number(),
  totalMinor: z.number(),
  currencyCode: z.string(),
  issuedAt: z.string(),
})
export type IssuedInvoiceDTO = z.infer<typeof issuedInvoiceDtoSchema>

export function parseClientsOpen(value: unknown): ClientsOpen {
  return clientsOpenSchema.parse(value)
}

export function parsePreview(value: unknown): InvoicePreviewDTO {
  return invoicePreviewDtoSchema.parse(value)
}

export function parseIssuedInvoice(value: unknown): IssuedInvoiceDTO {
  return issuedInvoiceDtoSchema.parse(value)
}

/** Open (un-invoiced) billable hours + money per client — the Projects header. */
export async function fetchClientsOpen(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ClientsOpen> {
  return parseClientsOpen(await getJson(baseUrl, '/api/billing/clients/open', fetchImpl))
}

export function parseOpenAging(value: unknown): OpenAging {
  return openAgingSchema.parse(value)
}

/** Open (un-invoiced) billable amounts bucketed by age — Reports "Revenue & Budget". */
export async function fetchOpenAging(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenAging> {
  return parseOpenAging(await getJson(baseUrl, '/api/billing/aging', fetchImpl))
}

export interface InvoiceWindowInput {
  readonly clientId: string
  readonly from: string
  readonly to: string
}

/** The open billable lines for a client + period (nothing is persisted). */
export async function previewInvoice(
  baseUrl: string,
  input: InvoiceWindowInput,
  fetchImpl: typeof fetch = fetch,
): Promise<InvoicePreviewDTO> {
  const qs = new URLSearchParams({
    clientId: input.clientId,
    from: input.from,
    to: input.to,
  }).toString()
  return parsePreview(await getJson(baseUrl, `/api/billing/invoices/preview?${qs}`, fetchImpl))
}

/** Issue an invoice for the selected entry ids; returns the frozen invoice. */
export async function issueInvoice(
  baseUrl: string,
  input: InvoiceWindowInput & { entryIds: readonly string[] },
  fetchImpl: typeof fetch = fetch,
): Promise<IssuedInvoiceDTO> {
  return parseIssuedInvoice(await postJson(baseUrl, '/api/billing/invoices', input, fetchImpl))
}

/** Void an invoice (undo): its entries return to the open pool. */
export async function voidInvoice(
  baseUrl: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await deleteJson(baseUrl, `/api/billing/invoices/${id}`, fetchImpl)
}

/** The CSV download URL for an issued invoice (opened via the browser/OS). */
export function invoiceExportUrl(baseUrl: string, id: string): string {
  return `${baseUrl}/api/billing/invoices/${id}/export`
}
