import { deleteJson, getJson, postJson } from './http.js'
import { num, nullableStr, parseArray, record, str } from './parse.js'

/**
 * The recurrence client (REQ-060, design v17 §F4): create / list / delete recurring **series**
 * and read their projected occurrences from the NestJS `recurrence` module. The occurrence math
 * is the deterministic core's, computed server-side from the stored rule (ADR-0005); the client
 * only parses rows and posts new series. Dates are plain `YYYY-MM-DD`; times are minute-of-day.
 */
export type SeriesFreq = 'daily' | 'weekly' | 'monthly'
export type SeriesEndKind = 'never' | 'until' | 'count'
export type SeriesKind = 'meeting' | 'focus' | 'break' | 'life'

const FREQS: readonly SeriesFreq[] = ['daily', 'weekly', 'monthly']
const END_KINDS: readonly SeriesEndKind[] = ['never', 'until', 'count']
const KINDS: readonly SeriesKind[] = ['meeting', 'focus', 'break', 'life']

/** A stored series rule, as returned by the API. */
export interface Series {
  readonly id: string
  readonly kind: SeriesKind
  readonly title: string
  readonly anchorDate: string
  readonly startMin: number
  readonly lenMin: number
  readonly freq: SeriesFreq
  readonly endKind: SeriesEndKind
  readonly untilDate: string | null
  readonly count: number | null
  readonly projectId: string | null
}

/** One projected occurrence of a series on a calendar day. */
export interface Occurrence {
  readonly seriesId: string
  readonly kind: SeriesKind
  readonly title: string
  readonly date: string
  readonly startMin: number
  readonly lenMin: number
  readonly projectId: string | null
}

function oneOf<T extends string>(all: readonly T[], value: string, fallback: T): T {
  return (all as readonly string[]).includes(value) ? (value as T) : fallback
}

export function parseSeries(value: unknown): Series {
  const o = record(value)
  return {
    id: str(o, 'id'),
    kind: oneOf(KINDS, str(o, 'kind'), 'focus'),
    title: str(o, 'title'),
    anchorDate: str(o, 'anchorDate'),
    startMin: num(o, 'startMin'),
    lenMin: num(o, 'lenMin'),
    freq: oneOf(FREQS, str(o, 'freq'), 'weekly'),
    endKind: oneOf(END_KINDS, str(o, 'endKind'), 'never'),
    untilDate: nullableStr(o, 'untilDate'),
    count: typeof o.count === 'number' ? o.count : null,
    projectId: nullableStr(o, 'projectId'),
  }
}

export function parseOccurrence(value: unknown): Occurrence {
  const o = record(value)
  return {
    seriesId: str(o, 'seriesId'),
    kind: oneOf(KINDS, str(o, 'kind'), 'focus'),
    title: str(o, 'title'),
    date: str(o, 'date'),
    startMin: num(o, 'startMin'),
    lenMin: num(o, 'lenMin'),
    projectId: nullableStr(o, 'projectId'),
  }
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
}

/** List the workspace's series. */
export async function listSeries(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Series[]> {
  return parseArray(await getJson(baseUrl, '/api/recurrence', fetchImpl), parseSeries)
}

/** The workspace's occurrences within `[from, to]` (inclusive `YYYY-MM-DD`). */
export async function listOccurrences(
  baseUrl: string,
  range: { from: string; to: string },
  fetchImpl: typeof fetch = fetch,
): Promise<Occurrence[]> {
  const qs = new URLSearchParams({ from: range.from, to: range.to }).toString()
  return parseArray(
    await getJson(baseUrl, `/api/recurrence/occurrences?${qs}`, fetchImpl),
    parseOccurrence,
  )
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
