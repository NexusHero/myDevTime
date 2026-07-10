import { getJson, postJson } from './http.js'
import { nullableStr, record, str } from './parse.js'

/**
 * The timer client (REQ-004): the write/read seam for the live timer against the
 * NestJS `tracking` entries routes (`/api/tracking/entries/timer/*`, ADR-0025).
 * Start/stop go through `postJson`, the running entry through `getJson`; each maps
 * to the typed `TimeEntry`. A *running* entry has `endedAt: null`, and
 * `/running` yields `null` when no timer is active. Timestamps stay ISO strings on
 * the wire — the deterministic core owns any duration math (ADR-0005), never here.
 */
export interface TimeEntry {
  readonly id: string
  readonly projectId: string | null
  readonly taskId: string | null
  readonly startedAt: string
  readonly endedAt: string | null
  readonly billable: boolean
  readonly source: string
  readonly note: string | null
}

/** Parse one time-entry DTO, throwing on the wrong shape. */
export function parseEntry(value: unknown): TimeEntry {
  const o = record(value)
  return {
    id: str(o, 'id'),
    projectId: nullableStr(o, 'projectId'),
    taskId: nullableStr(o, 'taskId'),
    startedAt: str(o, 'startedAt'),
    endedAt: nullableStr(o, 'endedAt'),
    billable: o.billable === true,
    source: str(o, 'source'),
    note: nullableStr(o, 'note'),
  }
}

/** Parse the `/running` response: an entry, or `null` when no timer is active. */
export function parseRunning(value: unknown): TimeEntry | null {
  if (value === null || value === undefined) return null
  return parseEntry(value)
}

export interface StartTimerInput {
  readonly projectId?: string | null
  readonly taskId?: string | null
  readonly billable?: boolean
  readonly note?: string | null
  readonly startedAt?: string
}

/**
 * The optimistic/demo running entry to show the instant a timer starts, before
 * (or without) a server round-trip. Same shape the server returns, with a
 * placeholder id and `endedAt: null`; the live path replaces it with the real
 * entry, the demo path keeps it.
 */
export function provisionalEntry(input: StartTimerInput, startedAt: Date): TimeEntry {
  return {
    id: 'pending',
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    startedAt: startedAt.toISOString(),
    endedAt: null,
    billable: input.billable ?? true,
    source: 'timer',
    note: input.note ?? null,
  }
}

/** Format an elapsed duration in ms as a `HH:MM:SS` stopwatch label (clamped at 0). */
export function formatStopwatch(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/** Start the live timer; returns the created running entry. */
export async function startTimer(
  baseUrl: string,
  input: StartTimerInput = {},
  fetchImpl: typeof fetch = fetch,
): Promise<TimeEntry> {
  const body = await postJson(baseUrl, '/api/tracking/entries/timer/start', input, fetchImpl)
  return parseEntry(body)
}

/** Stop the running timer; returns the closed entry. `endedAt` defaults server-side to now. */
export async function stopTimer(
  baseUrl: string,
  endedAt?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TimeEntry> {
  const body = await postJson(
    baseUrl,
    '/api/tracking/entries/timer/stop',
    endedAt === undefined ? {} : { endedAt },
    fetchImpl,
  )
  return parseEntry(body)
}

/** Read the workspace's currently running entry, or `null` when none is active. */
export async function getRunning(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TimeEntry | null> {
  const body = await getJson(baseUrl, '/api/tracking/entries/running', fetchImpl)
  return parseRunning(body)
}
