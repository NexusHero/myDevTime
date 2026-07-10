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

export interface DayPlan {
  readonly id: string
  readonly date: string
  readonly version: number
  readonly status: string
  readonly blocks: PlanBlock[]
  readonly plannedFocusMin: number
  readonly unplacedMin: number
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
