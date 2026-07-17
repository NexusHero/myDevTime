import { getJson, postJson } from './http.js'
import { z } from 'zod'

/**
 * The Co-Planner read/write seam (REQ-031, ADR-0011): a proposed day plan is a set
 * of ghost blocks the deterministic core placed (meetings anchor, focus fills the
 * gaps, breaks satisfy the rules). The client parses the plan and posts a day frame
 * + backlog to (re)generate it; it never places time — that is the server core's
 * job (ADR-0005). Minutes are measured from the top of the day.
 */
export const planBlockKindSchema = z.enum(['meeting', 'focus', 'break'])
export type PlanBlockKind = z.infer<typeof planBlockKindSchema>

export const planBlockSchema = z.object({
  startMin: z.number(),
  lenMin: z.number(),
  kind: planBlockKindSchema.catch('focus'),
  label: z.string(),
  taskId: z.string().nullable().catch(null).default(null),
})
export type PlanBlock = z.infer<typeof planBlockSchema>

export function parseBlock(value: unknown): PlanBlock {
  return planBlockSchema.parse(value)
}

export const planAnchorRefSchema = z.object({
  startMin: z.number(),
  lenMin: z.number(),
  label: z.string(),
})
export type PlanAnchorRef = z.infer<typeof planAnchorRefSchema>

export const dayPlanSchema = z.object({
  id: z.string(),
  date: z.string(),
  version: z.number(),
  status: z.string(),
  blocks: z.array(planBlockSchema),
  plannedFocusMin: z.number(),
  unplacedMin: z.number(),
  droppedAnchors: z.array(planAnchorRefSchema).catch([]).default([]),
})
export type DayPlan = z.infer<typeof dayPlanSchema>

/** Parse a plan row (must be present). */
export function parsePlanRow(value: unknown): DayPlan {
  // Map "planDate" from wire to "date"
  const parsed = dayPlanSchema
    .omit({ date: true })
    .and(z.object({ planDate: z.string() }))
    .parse(value)
  return { ...parsed, date: parsed.planDate }
}

/** Parse a plan row, or `null` when no plan exists for the day. */
export function parsePlan(value: unknown): DayPlan | null {
  if (value === null || value === undefined) return null
  return parsePlanRow(value)
}

export interface PlanAnchor {
  readonly startMin: number
  readonly lenMin: number
  readonly label: string
}
export interface PlanCandidate {
  readonly id: string
  readonly label: string
  readonly estimateMin: number
  readonly priority: number
}
export interface GeneratePlanInput {
  readonly date: string
  readonly dayStartMin: number
  readonly dayEndMin: number
  readonly anchors: readonly PlanAnchor[]
  readonly backlog: readonly PlanCandidate[]
}

/** The latest proposed plan for a day, or `null` when none exists yet. */
export async function getPlan(
  baseUrl: string,
  date: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DayPlan | null> {
  return parsePlan(await getJson(baseUrl, `/api/planner/plans?date=${date}`, fetchImpl))
}

/** Generate (and persist) a new proposal for a day from the deterministic core. */
export async function generatePlan(
  baseUrl: string,
  input: GeneratePlanInput,
  fetchImpl: typeof fetch = fetch,
): Promise<DayPlan> {
  return parsePlanRow(await postJson(baseUrl, '/api/planner/plans', input, fetchImpl))
}

export type PlanStatus = 'proposed' | 'accepted' | 'dismissed'

/** Record the user's response to a proposal (accept / dismiss); persists the status. */
export async function setPlanStatus(
  baseUrl: string,
  planId: string,
  status: PlanStatus,
  fetchImpl: typeof fetch = fetch,
): Promise<DayPlan> {
  return parsePlanRow(
    await postJson(baseUrl, `/api/planner/plans/${planId}/status`, { status }, fetchImpl),
  )
}

export const planReviewSchema = z.object({
  plannedFocusMin: z.number(),
  trackedFocusMin: z.number(),
  driftMin: z.number(),
})
export type PlanReview = z.infer<typeof planReviewSchema>

export function parsePlanReview(value: unknown): PlanReview {
  return planReviewSchema.parse(value)
}

/** The plan-vs-actual evening review for a stored plan (deterministic core). */
export async function getPlanReview(
  baseUrl: string,
  planId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PlanReview> {
  return parsePlanReview(await getJson(baseUrl, `/api/planner/plans/${planId}/review`, fetchImpl))
}

export const planBriefingSchema = z.object({
  source: z.enum(['deterministic', 'ai-proposal']).catch('deterministic'),
  charged: z.boolean().default(false),
  text: z.string(),
})
export type PlanBriefing = z.infer<typeof planBriefingSchema>

export function parsePlanBriefing(value: unknown): PlanBriefing {
  return planBriefingSchema.parse(value)
}

/** Request the AI day-briefing (costs one credit only when the AI actually writes it). */
export async function getPlanBriefing(
  baseUrl: string,
  planId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PlanBriefing> {
  return parsePlanBriefing(
    await postJson(baseUrl, `/api/planner/plans/${planId}/briefing`, {}, fetchImpl),
  )
}
