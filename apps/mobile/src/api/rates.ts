import { getJson, postJson, deleteJson } from './http.js'
import { z } from 'zod'

/**
 * The hourly-rate read/write model for the client (REQ-005). Rates are
 * effective-dated and scoped — workspace default → client → project → task, most
 * specific wins — and the `billing` module already owns the create/list/delete
 * API and the deterministic pricing (ADR-0005). The client only parses, formats,
 * and posts what the user typed; it never prices anything itself.
 */
export const rateLevelSchema = z.enum(['workspace', 'client', 'project', 'task'])
export type RateLevel = z.infer<typeof rateLevelSchema>

export const rateSchema = z.object({
  id: z.string(),
  level: rateLevelSchema.catch('workspace'),
  scopeId: z.string().nullable(),
  amountMinorPerHour: z.number(),
  effectiveFrom: z.string(),
})
export type Rate = z.infer<typeof rateSchema>

export function parseRate(value: unknown): Rate {
  return rateSchema.parse(value)
}

/** Every rate rule in the workspace (all levels), for the Rates screen. */
export async function fetchRates(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Rate[]> {
  const res = await getJson(baseUrl, '/api/billing/rates', fetchImpl)
  return z.array(rateSchema).parse(res)
}

export interface NewRate {
  readonly level: RateLevel
  readonly scopeId: string | null
  readonly amountMinorPerHour: number
  /** ISO instant from which the rate applies (the caller passes "now"). */
  readonly effectiveFrom: string
}

/** Create a rate rule; returns the persisted row. */
export async function createRate(
  baseUrl: string,
  rate: NewRate,
  fetchImpl: typeof fetch = fetch,
): Promise<Rate> {
  return parseRate(await postJson(baseUrl, '/api/billing/rates', rate, fetchImpl))
}

/** Remove a rate rule by id. */
export async function deleteRate(
  baseUrl: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await deleteJson(baseUrl, `/api/billing/rates/${encodeURIComponent(id)}`, fetchImpl)
}

/**
 * Parse a user-typed hourly rate (e.g. "78", "78.50", "78,50", "1.234,50") into
 * integer minor units per hour, or `null` if it isn't a non-negative amount. Pure,
 * so the money never depends on a locale-configured input widget — de and en both
 * accept comma or dot as the decimal mark; a single separator with 3 trailing
 * digits (e.g. "1.234") is read as a thousands group.
 */
export function eurosToMinor(input: string): number | null {
  const raw = input.trim().replace(/\s/g, '')
  if (raw === '' || !/^[0-9.,]+$/.test(raw)) return null
  const lastComma = raw.lastIndexOf(',')
  const lastDot = raw.lastIndexOf('.')
  const decimalPos = Math.max(lastComma, lastDot)
  let intPart: string
  let fracPart: string
  if (decimalPos === -1) {
    intPart = raw
    fracPart = ''
  } else {
    const sep = raw.charAt(decimalPos)
    const after = raw.slice(decimalPos + 1)
    // A lone separator with exactly 3 digits after it is a thousands group, not cents.
    if (after.length === 3 && raw.indexOf(sep) === decimalPos) {
      intPart = raw.replace(/[.,]/g, '')
      fracPart = ''
    } else {
      intPart = raw.slice(0, decimalPos).replace(/[.,]/g, '')
      fracPart = after
    }
  }
  if (fracPart.length > 2) return null
  const cents = (intPart === '' ? '0' : intPart) + fracPart.padEnd(2, '0')
  const minor = Number(cents)
  return Number.isFinite(minor) && minor >= 0 ? minor : null
}
