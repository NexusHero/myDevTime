import { postJson } from './http.js'
import { z } from 'zod'

/**
 * The AI standup client (REQ-014, ADR-0005/0029). The client sends its OWN grouped
 * durations (yesterday/today lines + typed blockers) and the server arranges them into a
 * slot-protected report the LLM narrates around — it never changes a number, and nothing
 * is written back to the timesheet. `source` carries the provenance the UI must show
 * (`ai-proposal` vs the free `deterministic` template when the provider is down or credits
 * are out); `charged` says whether a credit was debited (ADR-0008). Every field the API
 * omits or garbles is defaulted here so the UI never sees `undefined`.
 */
export const standupSourceSchema = z.enum(['deterministic', 'ai-proposal']).catch('deterministic')
export type StandupSource = z.infer<typeof standupSourceSchema>

export const standupResultSchema = z.object({
  source: standupSourceSchema,
  text: z.string(),
  charged: z.boolean().catch(false),
  /** The slot-protected report the narration was composed from — kept opaque here. */
  report: z.looseObject({}).catch({}),
})
export type StandupResult = z.infer<typeof standupResultSchema>

/** One grouped standup line: a project/task label and its tracked duration (ms). */
export interface StandupLine {
  readonly label: string
  readonly ms: number
}

/** The standup request: the caller's own grouped facts — the server invents nothing. */
export interface StandupInput {
  /** The report date as `YYYY-MM-DD`. */
  readonly date: string
  readonly yesterday: readonly StandupLine[]
  readonly today: readonly StandupLine[]
  readonly blockers: readonly string[]
}

export function parseStandupResult(value: unknown): StandupResult {
  return standupResultSchema.parse(value)
}

/** Compose a standup from the supplied lines (read-only — nothing is persisted). */
export async function generateStandup(
  baseUrl: string,
  input: StandupInput,
  fetchImpl: typeof fetch = fetch,
): Promise<StandupResult> {
  return parseStandupResult(await postJson(baseUrl, '/api/ai/standup', input, fetchImpl))
}
