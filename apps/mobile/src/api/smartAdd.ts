import type { SmartEntryDraft } from '@mydevtime/domain'
import { postJson } from './http.js'
import { z } from 'zod'

/**
 * Smart-Add client (REQ-047, design v13 K6). Posts a single phrase; the server's
 * deterministic `parseEntry` (Stage 1) classifies it, and only a vague phrase reaches the
 * grounded LLM (Stage 2) — either way the result is a **typed draft the user confirms**,
 * never a written entry (ADR-0005). `source` drives the provenance signature: violet only
 * for a real AI proposal.
 */
export const smartAddSourceSchema = z.enum(['deterministic', 'ai-proposal'])
export type SmartAddSource = z.infer<typeof smartAddSourceSchema>

export const smartEntryDraftSchema = z.object({
  kind: z.enum(['task', 'meeting', 'absence', 'travel', 'private']),
  title: z.string(),
  projectHint: z.string().nullable(),
  ticketKey: z.string().nullable(),
  dayOffset: z.number(),
  startMin: z.number().nullable(),
  endMin: z.number().nullable(),
  durationMs: z.number().nullable(),
  billable: z.boolean().default(true),
  confidence: z.number(),
  needsAi: z.boolean().default(false),
})

export const smartAddResultSchema = z.object({
  draft: smartEntryDraftSchema,
  source: smartAddSourceSchema,
  charged: z.boolean().default(false),
})
export type SmartAddResult = z.infer<typeof smartAddResultSchema>

export function parseSmartAddResult(value: unknown): SmartAddResult {
  return smartAddResultSchema.parse(value)
}

export interface SmartEntryTimes {
  readonly startedAt: string
  readonly endedAt: string
}

/** Resolve the local calendar date a draft's `dayOffset` refers to, relative to `now`.
 *  0/±1 are today/yesterday/tomorrow; `100 + weekday` (Mon=0) is the nearest upcoming
 *  occurrence of that weekday (today counts). Returns a Date at local midnight. */
export function resolveDraftDay(dayOffset: number, now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (dayOffset >= 100) {
    const targetIsoWeekday = ((dayOffset - 100) % 7) + 1 // 1=Mon…7=Sun
    const todayIso = d.getDay() === 0 ? 7 : d.getDay()
    const ahead = (targetIsoWeekday - todayIso + 7) % 7 // 0..6, today counts
    d.setDate(d.getDate() + ahead)
    return d
  }
  d.setDate(d.getDate() + dayOffset)
  return d
}

/**
 * Turn a typed draft into concrete start/end instants (the confirm step). A clock range
 * fixes both ends; a lone start plus a duration extends forward; a bare duration ends now
 * for today or at 17:00 for another day; otherwise a default one-hour block. The server
 * still validates the interval (ADR-0005).
 */
export function smartDraftToEntryTimes(draft: SmartEntryDraft, now: Date): SmartEntryTimes {
  const day = resolveDraftDay(draft.dayOffset, now)
  const atMin = (min: number): Date => new Date(day.getTime() + min * 60_000)
  const HOUR = 3_600_000

  if (draft.startMin !== null && draft.endMin !== null) {
    return {
      startedAt: atMin(draft.startMin).toISOString(),
      endedAt: atMin(draft.endMin).toISOString(),
    }
  }
  if (draft.startMin !== null) {
    const start = atMin(draft.startMin)
    const end = new Date(start.getTime() + (draft.durationMs ?? HOUR))
    return { startedAt: start.toISOString(), endedAt: end.toISOString() }
  }
  const isToday = draft.dayOffset === 0
  const end = isToday ? new Date(now) : atMin(17 * 60)
  const start = new Date(end.getTime() - (draft.durationMs ?? HOUR))
  return { startedAt: start.toISOString(), endedAt: end.toISOString() }
}

/** Classify a phrase into a typed Smart-Add draft (never persists). */
export async function fetchSmartAdd(
  baseUrl: string,
  text: string,
  knownProjects: readonly string[] = [],
  fetchImpl: typeof fetch = fetch,
): Promise<SmartAddResult> {
  const body = knownProjects.length > 0 ? { text, knownProjects } : { text }
  return parseSmartAddResult(await postJson(baseUrl, '/api/ai/smart-add', body, fetchImpl))
}
