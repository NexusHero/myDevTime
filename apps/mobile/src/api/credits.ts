import { getJson } from './http.js'
import { num, nullableStr, parseArray, record, str } from './parse.js'

/**
 * The AI-credit ledger read model for the client (REQ-027): the balance, the
 * append-only ledger, and the usage breakdown the `billing` credit service derives
 * from the deterministic core (ADR-0005). Feature gates read the balance here,
 * never a payment SDK. The client only parses and formats.
 */
export interface CreditEntry {
  readonly id: string
  readonly kind: string
  readonly amount: number
  readonly category: string
  readonly reason: string | null
  readonly at: string
}

export function parseEntry(value: unknown): CreditEntry {
  const o = record(value)
  return {
    id: str(o, 'id'),
    kind: str(o, 'kind'),
    amount: num(o, 'amount'),
    category: str(o, 'category'),
    reason: nullableStr(o, 'reason'),
    at: str(o, 'createdAt'),
  }
}

export interface UsageBucket {
  readonly category: string
  readonly credits: number
}

export function parseUsage(value: unknown): UsageBucket[] {
  return parseArray(value, o => ({ category: str(o, 'category'), credits: num(o, 'credits') }))
}

/** The current credit balance. */
export async function fetchBalance(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const o = record(await getJson(baseUrl, '/api/billing/credits', fetchImpl))
  return num(o, 'balance')
}

/** The most recent ledger entries, newest first. */
export async function fetchLedger(
  baseUrl: string,
  limit = 50,
  fetchImpl: typeof fetch = fetch,
): Promise<CreditEntry[]> {
  return parseArray(
    await getJson(baseUrl, `/api/billing/credits/ledger?limit=${String(limit)}`, fetchImpl),
    parseEntry,
  )
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
