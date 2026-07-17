import { getJson } from './http.js'
import { z } from 'zod'

/**
 * The reports read model for the client (REQ-005): parse the workspace summary the
 * NestJS `tracking` module aggregates (`/api/tracking/summary`) and join its
 * per-project buckets (keyed by id, computed by the deterministic core) with human
 * project names from the catalog. Parsing and the join are pure and tested; the
 * numbers stay exactly as the server computed them (ADR-0005).
 */
export const projectSummaryDtoSchema = z.object({
  projectId: z.string(),
  spentMs: z.number(),
  billableMs: z.number(),
  daily: z.array(z.number()),
})
export type ProjectSummaryDTO = z.infer<typeof projectSummaryDtoSchema>

export const summarySchema = z.object({
  totalMs: z.number(),
  billableMs: z.number(),
  days: z.array(z.string()),
  byProject: z.array(projectSummaryDtoSchema),
})
export type Summary = z.infer<typeof summarySchema>

export function parseSummary(value: unknown): Summary {
  return summarySchema.parse(value)
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

/**
 * The billable-money read model (REQ-005): the `billing` module prices only
 * *billable* entries inside the window (at the rate in effect at each entry's
 * start) and returns the total and a per-project breakdown in minor units. The
 * numbers are the deterministic core's (ADR-0005); the client only parses them.
 */
export const projectCostDtoSchema = z.object({
  projectId: z.string(),
  costMinor: z.number(),
})
export type ProjectCostDTO = z.infer<typeof projectCostDtoSchema>

export const billingSummarySchema = z.object({
  billableMinor: z.number(),
  currencyCode: z.string(),
  byProject: z.array(projectCostDtoSchema),
})
export type BillingSummary = z.infer<typeof billingSummarySchema>

export function parseBillingSummary(value: unknown): BillingSummary {
  return billingSummarySchema.parse(value)
}

export interface MoneyRange {
  readonly from: string
  readonly to: string
}

/** Fetch the windowed billable-money summary for a time window. */
export async function fetchBillingSummary(
  baseUrl: string,
  range: MoneyRange,
  fetchImpl: typeof fetch = fetch,
): Promise<BillingSummary> {
  const qs = new URLSearchParams({ from: range.from, to: range.to }).toString()
  return parseBillingSummary(await getJson(baseUrl, `/api/billing/summary?${qs}`, fetchImpl))
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
