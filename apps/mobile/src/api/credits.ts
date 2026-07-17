import { getJson } from './http.js'
import { z } from 'zod'

/**
 * The AI-credit ledger read model for the client (REQ-027): the balance, the
 * append-only ledger, and the usage breakdown the `billing` credit service derives
 * from the deterministic core (ADR-0005). Feature gates read the balance here,
 * never a payment SDK. The client only parses and formats.
 */
export const creditEntrySchema = z.object({
  id: z.string(),
  kind: z.string(),
  amount: z.number(),
  category: z.string(),
  reason: z.string().nullable(),
  at: z.string(),
})
export type CreditEntry = z.infer<typeof creditEntrySchema>

export function parseEntry(value: unknown): CreditEntry {
  // mapped from 'createdAt' to 'at'
  const parsed = creditEntrySchema
    .omit({ at: true })
    .and(z.object({ createdAt: z.string() }))
    .parse(value)
  return { ...parsed, at: parsed.createdAt }
}

export const usageBucketSchema = z.object({
  category: z.string(),
  credits: z.number(),
})
export type UsageBucket = z.infer<typeof usageBucketSchema>

export function parseUsage(value: unknown): UsageBucket[] {
  return z.array(usageBucketSchema).parse(value)
}

/** The current credit balance. */
export async function fetchBalance(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const res = await getJson(baseUrl, '/api/billing/credits', fetchImpl)
  return z.object({ balance: z.number() }).parse(res).balance
}

/** The most recent ledger entries, newest first. */
export async function fetchLedger(
  baseUrl: string,
  limit = 50,
  fetchImpl: typeof fetch = fetch,
): Promise<CreditEntry[]> {
  const res = await getJson(
    baseUrl,
    `/api/billing/credits/ledger?limit=${String(limit)}`,
    fetchImpl,
  )
  return z
    .array(creditEntrySchema.omit({ at: true }).and(z.object({ createdAt: z.string() })))
    .parse(res)
    .map(x => ({ ...x, at: x.createdAt }))
}

/** Credits spent per category over a window. */
export async function fetchUsage(
  baseUrl: string,
  range: { from: string; to: string },
  fetchImpl: typeof fetch = fetch,
): Promise<UsageBucket[]> {
  const qs = new URLSearchParams({ from: range.from, to: range.to }).toString()
  return parseUsage(await getJson(baseUrl, `/api/billing/credits/usage?${qs}`, fetchImpl))
}

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  'monthly-grant': 'Monthly grant',
  'meeting-insights': 'Meeting insights',
  'co-planner': 'Co-Planner',
  'nl-entry': 'NL time entry',
  assistant: 'Assistant',
  pack: 'Credit pack',
}

/** A human label for a credit category slug (falls back to a Title-cased slug). */
export function prettyCategory(category: string): string {
  const known = CATEGORY_LABELS[category]
  if (known) return known
  return category
    .split('-')
    .map(w => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}
