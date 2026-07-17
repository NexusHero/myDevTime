import { postJson } from './http.js'
import { z } from 'zod'
import { parseEntry, type TimeEntry } from './timer.js'
import type { Client } from '../screens/projectsData'

/**
 * Natural-language time entry (REQ-013). The `ai` module parses a phrase into a
 * **draft** the user confirms; nothing is written until confirmation, and even the
 * LLM path returns a draft, never an entry (ADR-0005/0029). The client posts the
 * text, previews the draft, resolves the project hint against the catalog, and —
 * only on confirm — creates a real entry through the tracking route.
 */
export const draftSourceSchema = z.enum(['deterministic', 'ai-proposal', 'none'])
export type DraftSource = z.infer<typeof draftSourceSchema>

export const nlDraftSchema = z.object({
  durationMs: z.number(),
  dayOffset: z.number(),
  projectHint: z.string().nullable(),
  note: z.string().nullable(),
  billable: z.boolean().default(true),
  confidence: z.number(),
})
export type NlDraft = z.infer<typeof nlDraftSchema>

export const nlDraftResultSchema = z.object({
  draft: nlDraftSchema.nullable().catch(null).default(null),
  source: draftSourceSchema,
})
export type NlDraftResult = z.infer<typeof nlDraftResultSchema>

export function parseDraftResult(value: unknown): NlDraftResult {
  return nlDraftResultSchema.parse(value)
}

/** The project/ticket vocabulary the server matches a bare name/key against (REQ-013, M6). */
export function catalogVocabulary(catalog: readonly Client[]): string[] {
  return catalog.flatMap(c => c.projects.map(p => p.name))
}

/** Parse a phrase into a draft (never persists). `knownProjects` resolves bare names/keys. */
export async function fetchNlDraft(
  baseUrl: string,
  text: string,
  knownProjects: readonly string[] = [],
  fetchImpl: typeof fetch = fetch,
): Promise<NlDraftResult> {
  const body = knownProjects.length > 0 ? { text, knownProjects } : { text }
  return parseDraftResult(await postJson(baseUrl, '/api/ai/nl-entry', body, fetchImpl))
}

/** Resolve a project hint against the catalog by case-insensitive name (exact, then prefix). */
export function resolveProjectId(catalog: readonly Client[], hint: string | null): string | null {
  if (!hint) return null
  const needle = hint.toLowerCase()
  const projects = catalog.flatMap(c => c.projects)
  const exact = projects.find(p => p.name.toLowerCase() === needle)
  if (exact) return exact.id
  const prefix = projects.find(p => p.name.toLowerCase().startsWith(needle))
  return prefix ? prefix.id : null
}

export interface DraftEntryTimes {
  readonly startedAt: string
  readonly endedAt: string
}

/**
 * Turn a draft into concrete start/end instants: a today entry ends now; a past
 * day ends at 17:00 local. The server still validates the interval (ADR-0005).
 */
export function draftToEntryTimes(draft: NlDraft, now: Date): DraftEntryTimes {
  const end = new Date(now)
  if (draft.dayOffset !== 0) {
    end.setDate(end.getDate() + draft.dayOffset)
    end.setHours(17, 0, 0, 0)
  }
  const start = new Date(end.getTime() - draft.durationMs)
  return { startedAt: start.toISOString(), endedAt: end.toISOString() }
}

export interface CreateEntryInput {
  startedAt: string
  endedAt: string
  projectId?: string | null
  note?: string | null
  billable?: boolean
}

/** Create a manual entry (the confirm step of NL capture). */
export async function createEntry(
  baseUrl: string,
  input: CreateEntryInput,
  fetchImpl: typeof fetch = fetch,
): Promise<TimeEntry> {
  return parseEntry(await postJson(baseUrl, '/api/tracking/entries', input, fetchImpl))
}
