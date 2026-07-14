import { deleteJson, getJson, postJson } from './http.js'
import { nullableStr, num, parseArray, record, str } from './parse.js'

/**
 * Client for the invoicing / "Abrechnung" endpoints (design v6, REQ-005/009).
 * Parsing is pure and tested; every amount stays exactly as the server's
 * deterministic core computed it (ADR-0005) — the client never re-derives money.
 */

export interface ClientOpen {
  readonly clientId: string
  readonly openMs: number
  readonly openMinor: number
}
export interface ClientsOpen {
  readonly clients: readonly ClientOpen[]
  readonly currencyCode: string
}

export interface InvoiceLineDTO {
  readonly entryId: string
  readonly projectId: string
  readonly taskId: string | null
  readonly start: number
  readonly durationMs: number
  readonly amountMinor: number
  readonly priced: boolean
  readonly note: string | null
}
export interface InvoicePreviewDTO {
  readonly lines: readonly InvoiceLineDTO[]
  readonly currencyCode: string
}

export interface IssuedInvoiceDTO {
  readonly id: string
  readonly clientId: string | null
  readonly periodStart: string
  readonly periodEnd: string
  readonly totalMs: number
  readonly totalMinor: number
  readonly currencyCode: string
  readonly issuedAt: string
}

export function parseClientsOpen(value: unknown): ClientsOpen {
  const o = record(value)
  return {
    currencyCode: str(o, 'currencyCode'),
    clients: parseArray(o.clients, c => ({
      clientId: str(c, 'clientId'),
      openMs: num(c, 'openMs'),
      openMinor: num(c, 'openMinor'),
    })),
  }
}

function parseLine(o: Record<string, unknown>): InvoiceLineDTO {
  return {
    entryId: str(o, 'entryId'),
    projectId: str(o, 'projectId'),
    taskId: nullableStr(o, 'taskId'),
    start: num(o, 'start'),
    durationMs: num(o, 'durationMs'),
    amountMinor: num(o, 'amountMinor'),
    priced: o.priced === true,
    note: nullableStr(o, 'note'),
  }
}

export function parsePreview(value: unknown): InvoicePreviewDTO {
  const o = record(value)
  return { currencyCode: str(o, 'currencyCode'), lines: parseArray(o.lines, parseLine) }
}

export function parseIssuedInvoice(value: unknown): IssuedInvoiceDTO {
  const o = record(value)
  return {
    id: str(o, 'id'),
    clientId: nullableStr(o, 'clientId'),
    periodStart: str(o, 'periodStart'),
    periodEnd: str(o, 'periodEnd'),
    totalMs: num(o, 'totalMs'),
    totalMinor: num(o, 'totalMinor'),
    currencyCode: str(o, 'currencyCode'),
    issuedAt: str(o, 'issuedAt'),
  }
}

/** Open (un-invoiced) billable hours + money per client — the Projects header. */
export async function fetchClientsOpen(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ClientsOpen> {
  return parseClientsOpen(await getJson(baseUrl, '/api/billing/clients/open', fetchImpl))
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
