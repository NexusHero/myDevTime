import { getJson } from './http.js'
import { num, numberArray, parseArray, record, str, stringArray } from './parse.js'

/**
 * The reports read model for the client (REQ-005): parse the workspace summary the
 * NestJS `tracking` module aggregates (`/api/tracking/summary`) and join its
 * per-project buckets (keyed by id, computed by the deterministic core) with human
 * project names from the catalog. Parsing and the join are pure and tested; the
 * numbers stay exactly as the server computed them (ADR-0005).
 */
export interface ProjectSummaryDTO {
  readonly projectId: string
  readonly spentMs: number
  readonly billableMs: number
  readonly daily: number[]
}
export interface Summary {
  readonly totalMs: number
  readonly billableMs: number
  readonly days: string[]
  readonly byProject: ProjectSummaryDTO[]
}

export function parseSummary(value: unknown): Summary {
  const o = record(value)
  return {
    totalMs: num(o, 'totalMs'),
    billableMs: num(o, 'billableMs'),
    days: stringArray(o.days),
    byProject: parseArray(o.byProject, p => ({
      projectId: str(p, 'projectId'),
      spentMs: num(p, 'spentMs'),
      billableMs: num(p, 'billableMs'),
      daily: numberArray(p.daily),
    })),
  }
}

export interface SummaryRange {
  readonly from: string
  readonly to: string
  readonly tz: string
}

/** Fetch the workspace summary for a time window. */
export async function fetchSummary(
  baseUrl: string,
  range: SummaryRange,
  fetchImpl: typeof fetch = fetch,
): Promise<Summary> {
  const qs = new URLSearchParams({ from: range.from, to: range.to, tz: range.tz }).toString()
  return parseSummary(await getJson(baseUrl, `/api/tracking/summary?${qs}`, fetchImpl))
}

const NO_PROJECT = '(none)'

export interface ReportProject {
  readonly id: string
  readonly name: string
  readonly spentMs: number
  readonly daily: number[]
}

/** Join summary buckets with project names; the "(none)" bucket becomes "No project". */
export function toReportProjects(
  summary: Summary,
  nameById: ReadonlyMap<string, string>,
): ReportProject[] {
  return summary.byProject.map(p => ({
    id: p.projectId,
    name: p.projectId === NO_PROJECT ? 'No project' : (nameById.get(p.projectId) ?? p.projectId),
    spentMs: p.spentMs,
    daily: [...p.daily],
  }))
}
