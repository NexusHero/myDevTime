import { patchJson, postJson } from './http.js'
import { z } from 'zod'
import { parseEntry, type TimeEntry } from './timer.js'

/**
 * The AI categorization client (REQ-012, ADR-0005/0029). The client sends the narrow
 * projections of its uncategorized entries plus the project vocabulary; the server returns
 * **proposals only** — a suggested project name, tags, billable flag and a coarse
 * confidence per entry. Nothing is applied until the user taps Apply, which goes through
 * the ordinary tracking PATCH below. `source: 'none'` is the honest degradation when the
 * provider is down or had nothing confident to say. Every field the API omits or garbles
 * is defaulted here so the UI never sees `undefined`.
 */
export const categorizeSourceSchema = z.enum(['ai-proposal', 'none']).catch('none')
export type CategorizeSource = z.infer<typeof categorizeSourceSchema>

export const categoryProposalSchema = z.object({
  /** The caller's key for the entry this proposal is about (we send the entry id). */
  key: z.string(),
  /** The proposed project NAME (resolved against the catalog client-side), or null. */
  project: z.string().nullable().catch(null),
  tags: z.array(z.string()).catch([]),
  billable: z.boolean().nullable().catch(null),
  confidence: z.enum(['low', 'medium', 'high']).catch('low'),
})
export type CategoryProposal = z.infer<typeof categoryProposalSchema>

export const categorizeResultSchema = z.object({
  source: categorizeSourceSchema,
  charged: z.boolean().catch(false),
  proposals: z.array(categoryProposalSchema).catch([]),
})
export type CategorizeResult = z.infer<typeof categorizeResultSchema>

/** The narrow projection of an entry the categorizer sees (never the whole entry). */
export interface CategorizeItem {
  readonly key: string
  readonly note: string | null
  readonly source: string
}

export function parseCategorizeResult(value: unknown): CategorizeResult {
  return categorizeResultSchema.parse(value)
}

/** Ask for category proposals over `items` (read-only — the server applies nothing). */
export async function proposeCategories(
  baseUrl: string,
  items: readonly CategorizeItem[],
  knownProjects: readonly string[],
  fetchImpl: typeof fetch = fetch,
): Promise<CategorizeResult> {
  return parseCategorizeResult(
    await postJson(baseUrl, '/api/ai/categorize', { items, knownProjects }, fetchImpl),
  )
}

/** What applying an accepted proposal writes: the resolved project id (+ billable if proposed). */
export interface ApplyCategoryPatch {
  readonly projectId: string
  readonly billable?: boolean
}

/**
 * Apply ONE user-accepted proposal to its entry: `PATCH /api/tracking/entries/:id` — the
 * same route every other entry edit uses. This is the confirm step (ADR-0005): the AI
 * proposed, the user tapped Apply, and only then does the deterministic tracking module
 * write. Returns the updated entry.
 */
export async function applyCategoryProposal(
  baseUrl: string,
  entryId: string,
  patch: ApplyCategoryPatch,
  fetchImpl: typeof fetch = fetch,
): Promise<TimeEntry> {
  return parseEntry(await patchJson(baseUrl, `/api/tracking/entries/${entryId}`, patch, fetchImpl))
}
