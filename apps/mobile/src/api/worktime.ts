import { getJson } from './http.js'
import { num, record } from './parse.js'

/**
 * The worktime read model for the client (REQ-028): parse the overtime balance the
 * NestJS `worktime` module computes (`GET /api/worktime/summary`) — net worked
 * time vs the target schedule over a window. The numbers are the deterministic
 * core's (ADR-0005); the client only parses them. `balanceMs` is signed (negative
 * = under target).
 */
export interface Overtime {
  readonly workedMs: number
  readonly targetMs: number
  readonly balanceMs: number
}

export function parseOvertime(value: unknown): Overtime {
  const o = record(value)
  return {
    workedMs: num(o, 'workedMs'),
    targetMs: num(o, 'targetMs'),
    balanceMs: num(o, 'balanceMs'),
  }
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
