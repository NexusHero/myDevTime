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
