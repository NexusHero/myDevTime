import { getJson, postJson } from './http.js'
import { num, parseArray, record, str } from './parse.js'

/**
 * The Co-Planner read/write seam (REQ-031, ADR-0011): a proposed day plan is a set
 * of ghost blocks the deterministic core placed (meetings anchor, focus fills the
 * gaps, breaks satisfy the rules). The client parses the plan and posts a day frame
 * + backlog to (re)generate it; it never places time — that is the server core's
 * job (ADR-0005). Minutes are measured from the top of the day.
 */
export type PlanBlockKind = 'meeting' | 'focus' | 'break'

export interface PlanBlock {
  readonly startMin: number
  readonly lenMin: number
  readonly kind: PlanBlockKind
  readonly label: string
  readonly taskId: string | null
}

export interface PlanAnchorRef {
  readonly startMin: number
  readonly lenMin: number
  readonly label: string
}

export interface DayPlan {
  readonly id: string
  readonly date: string
  readonly version: number
  readonly status: string
  readonly blocks: PlanBlock[]
  readonly plannedFocusMin: number
  readonly unplacedMin: number
  /** Meetings the planner could not place (overlap / out of window) — surfaced as a warning. */
  readonly droppedAnchors: PlanAnchorRef[]
}

const KINDS: readonly PlanBlockKind[] = ['meeting', 'focus', 'break']

export function parseBlock(value: unknown): PlanBlock {
  const o = record(value)
  const kind = str(o, 'kind')
  return {
    startMin: num(o, 'startMin'),
    lenMin: num(o, 'lenMin'),
    kind: (KINDS as readonly string[]).includes(kind) ? (kind as PlanBlockKind) : 'focus',
    label: str(o, 'label'),
    taskId: typeof o.taskId === 'string' ? o.taskId : null,
  }
}

export function parseAnchorRef(value: unknown): PlanAnchorRef {
  const o = record(value)
  return { startMin: num(o, 'startMin'), lenMin: num(o, 'lenMin'), label: str(o, 'label') }
}

/** Parse a plan row (must be present). */
export function parsePlanRow(value: unknown): DayPlan {
  const o = record(value)
  return {
    id: str(o, 'id'),
    date: str(o, 'planDate'),
    version: num(o, 'version'),
    status: str(o, 'status'),
    blocks: parseArray(o.blocks, parseBlock),
    plannedFocusMin: num(o, 'plannedFocusMin'),
    unplacedMin: num(o, 'unplacedMin'),
    droppedAnchors:
      o.droppedAnchors === undefined ? [] : parseArray(o.droppedAnchors, parseAnchorRef),
  }
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

/** The evening review for a plan: planned vs tracked focus, and the drift between. */
export interface PlanReview {
  readonly plannedFocusMin: number
  readonly trackedFocusMin: number
  /** `tracked − planned`; negative means under the plan. */
  readonly driftMin: number
}

export function parsePlanReview(value: unknown): PlanReview {
  const o = record(value)
  return {
    plannedFocusMin: num(o, 'plannedFocusMin'),
    trackedFocusMin: num(o, 'trackedFocusMin'),
    driftMin: num(o, 'driftMin'),
  }
}

/** The plan-vs-actual evening review for a stored plan (deterministic core). */
export async function getPlanReview(
  baseUrl: string,
  planId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PlanReview> {
  return parsePlanReview(await getJson(baseUrl, `/api/planner/plans/${planId}/review`, fetchImpl))
}

/** The AI day-briefing for a plan: a short coaching text, or a deterministic summary. */
export interface PlanBriefing {
  readonly source: 'deterministic' | 'ai-proposal'
  readonly charged: boolean
  readonly text: string
}

export function parsePlanBriefing(value: unknown): PlanBriefing {
  const o = record(value)
  const source = str(o, 'source')
  return {
    source: source === 'ai-proposal' ? 'ai-proposal' : 'deterministic',
    charged: o.charged === true,
    text: str(o, 'text'),
  }
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
