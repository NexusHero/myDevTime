import { getJson, postJson } from './http.js'
import { z } from 'zod'

/**
 * The worktime read model for the client (REQ-028): parse the overtime balance the
 * NestJS `worktime` module computes (`GET /api/worktime/summary`) — net worked
 * time vs the target schedule over a window. The numbers are the deterministic
 * core's (ADR-0005); the client only parses them. `balanceMs` is signed (negative
 * = under target).
 */
export const overtimeSchema = z.object({
  workedMs: z.number(),
  targetMs: z.number(),
  balanceMs: z.number(),
})
export type Overtime = z.infer<typeof overtimeSchema>

export function parseOvertime(value: unknown): Overtime {
  return overtimeSchema.parse(value)
}

export interface OvertimeRange {
  readonly from: string
  readonly to: string
  readonly tz: string
}

/** Fetch the overtime balance for a time window. */
export async function fetchWorktimeSummary(
  baseUrl: string,
  range: OvertimeRange,
  fetchImpl: typeof fetch = fetch,
): Promise<Overtime> {
  const qs = new URLSearchParams({ from: range.from, to: range.to, tz: range.tz }).toString()
  return parseOvertime(await getJson(baseUrl, `/api/worktime/summary?${qs}`, fetchImpl))
}

/**
 * The punch-clock read/write seam (REQ-028): a shift is a work-day punch pair; a
 * *running* one has `endedAt: null`. `breakShortfallMs` is the server-computed
 * ArbZG §4 warning (0 while open or compliant). Timestamps stay ISO strings on the
 * wire — the deterministic core owns all duration math (ADR-0005).
 */
export const shiftSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  breakMs: z.number(),
  source: z.string(),
  breakShortfallMs: z.number().default(0),
})
export type Shift = z.infer<typeof shiftSchema>

export function parseShift(value: unknown): Shift {
  return shiftSchema.parse(value)
}

/** Parse the running-shift response: a shift, or `null` when clocked out. */
export function parseRunning(value: unknown): Shift | null {
  if (value === null || value === undefined) return null
  return shiftSchema.parse(value)
}

export interface ShiftWindow {
  readonly from: string
  readonly to: string
}

/** The workspace's currently open shift, or `null` when clocked out. */
export async function getRunningShift(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Shift | null> {
  return parseRunning(await getJson(baseUrl, '/api/worktime/running', fetchImpl))
}

/** List shifts whose start falls in the window (newest first). */
export async function listShifts(
  baseUrl: string,
  window: ShiftWindow,
  fetchImpl: typeof fetch = fetch,
): Promise<Shift[]> {
  const qs = new URLSearchParams({ from: window.from, to: window.to }).toString()
  const res = await getJson(baseUrl, `/api/worktime/shifts?${qs}`, fetchImpl)
  return z.array(shiftSchema).parse(res)
}

/** Clock in (open a shift). */
export async function clockIn(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<Shift> {
  return parseShift(await postJson(baseUrl, '/api/worktime/clock-in', {}, fetchImpl))
}

/** Clock out (close the open shift), optionally recording total break minutes. */
export async function clockOut(
  baseUrl: string,
  breakMs?: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Shift> {
  const body = breakMs === undefined ? {} : { breakMs }
  return parseShift(await postJson(baseUrl, '/api/worktime/clock-out', body, fetchImpl))
}

/**
 * The download URL for the signable monthly work-time statement (REQ-052, design v13 X) —
 * the "real punch clock" PDF, one month per A4 page. The browser (or a native link)
 * fetches it with the session cookie, so the endpoint stays auth-guarded and
 * workspace-scoped. `tz` defaults to the device zone; `locale` picks EN/DE headings.
 */
export function statementUrl(
  baseUrl: string,
  opts: { year: number; month: number; tz?: string; locale?: 'en' | 'de' },
): string {
  const tz = opts.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const qs = new URLSearchParams({
    year: String(opts.year),
    month: String(opts.month),
    tz,
    locale: opts.locale ?? 'en',
  })
  return `${baseUrl}/api/worktime/statement?${qs.toString()}`
}
