import { deleteJson, getJson, postJson } from './http.js'
import { z } from 'zod'

/**
 * The recurrence client (REQ-060, design v17 §F4): create / list / delete recurring **series**
 * and read their projected occurrences from the NestJS `recurrence` module. The occurrence math
 * is the deterministic core's, computed server-side from the stored rule (ADR-0005); the client
 * only parses rows and posts new series. Dates are plain `YYYY-MM-DD`; times are minute-of-day.
 */
export const seriesFreqSchema = z.enum(['daily', 'weekly', 'monthly'])
export type SeriesFreq = z.infer<typeof seriesFreqSchema>

export const seriesEndKindSchema = z.enum(['never', 'until', 'count'])
export type SeriesEndKind = z.infer<typeof seriesEndKindSchema>

export const seriesKindSchema = z.enum(['meeting', 'focus', 'break', 'life'])
export type SeriesKind = z.infer<typeof seriesKindSchema>

export const seriesSchema = z.object({
  id: z.string(),
  kind: seriesKindSchema.catch('focus'),
  title: z.string(),
  anchorDate: z.string(),
  startMin: z.number(),
  lenMin: z.number(),
  freq: seriesFreqSchema.catch('weekly'),
  endKind: seriesEndKindSchema.catch('never'),
  untilDate: z.string().nullable(),
  count: z.number().nullable(),
  projectId: z.string().nullable(),
  priority: z.number().nullable().catch(null).default(null),
  note: z.string().nullable().catch(null).default(null),
})
export type Series = z.infer<typeof seriesSchema>

export const occurrenceSchema = z.object({
  seriesId: z.string(),
  kind: seriesKindSchema.catch('focus'),
  title: z.string(),
  date: z.string(),
  startMin: z.number(),
  lenMin: z.number(),
  projectId: z.string().nullable(),
  priority: z.number().nullable().catch(null).default(null),
  note: z.string().nullable().catch(null).default(null),
})
export type Occurrence = z.infer<typeof occurrenceSchema>

export function parseSeries(value: unknown): Series {
  return seriesSchema.parse(value)
}

export function parseOccurrence(value: unknown): Occurrence {
  return occurrenceSchema.parse(value)
}

export interface CreateSeriesInput {
  readonly kind: SeriesKind
  readonly title: string
  readonly anchorDate: string
  readonly startMin: number
  readonly lenMin: number
  readonly freq: SeriesFreq
  readonly endKind?: SeriesEndKind
  readonly untilDate?: string | null
  readonly count?: number | null
  readonly projectId?: string | null
  /** Task priority (1 = high · 2 = med · 3 = low) — a hand-created entry (design v19). */
  readonly priority?: number | null
  /** Free-text note for a hand-created entry (design v19). */
  readonly note?: string | null
}

/** List the workspace's series. */
export async function listSeries(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Series[]> {
  const res = await getJson(baseUrl, '/api/recurrence', fetchImpl)
  return z.array(seriesSchema).parse(res)
}

/** The workspace's occurrences within `[from, to]` (inclusive `YYYY-MM-DD`). */
export async function listOccurrences(
  baseUrl: string,
  range: { from: string; to: string },
  fetchImpl: typeof fetch = fetch,
): Promise<Occurrence[]> {
  const qs = new URLSearchParams({ from: range.from, to: range.to }).toString()
  const res = await getJson(baseUrl, `/api/recurrence/occurrences?${qs}`, fetchImpl)
  return z.array(occurrenceSchema).parse(res)
}

/** Create a recurring series; returns the stored rule. */
export async function createSeries(
  baseUrl: string,
  input: CreateSeriesInput,
  fetchImpl: typeof fetch = fetch,
): Promise<Series> {
  return parseSeries(await postJson(baseUrl, '/api/recurrence', input, fetchImpl))
}

/** Delete a series. */
export async function deleteSeries(
  baseUrl: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await deleteJson(baseUrl, `/api/recurrence/${id}`, fetchImpl)
}

/** End a series the day before `at` — the Outlook "this and following" split. */
export async function truncateSeries(
  baseUrl: string,
  id: string,
  at: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Series> {
  return parseSeries(await postJson(baseUrl, `/api/recurrence/${id}/truncate`, { at }, fetchImpl))
}
