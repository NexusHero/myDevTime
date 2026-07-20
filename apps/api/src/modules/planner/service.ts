import { and, desc, eq, gte, isNotNull, isNull, lt } from 'drizzle-orm'
import {
  applyProposal,
  buildDayPlan,
  reviewDayPlan,
  type DayPlan,
  type PlanBlockMutation,
  type PlanInput,
  type PlanReview,
} from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { plans, protectedTimes, timeEntries } from '../../db/schema.js'
import { NotFoundError, ValidationError } from '../../errors.js'

/**
 * Co-Planner persistence (REQ-031, ADR-0011): versioned day plans, workspace-scoped
 * by construction. The service runs the deterministic `buildDayPlan` core and
 * stores its blocks verbatim — it never places time itself (ADR-0005). A new
 * proposal for a day is a new version; accept/adjust/dismiss only flips status.
 */
export type PlanRow = typeof plans.$inferSelect
export const PLAN_STATUSES = ['proposed', 'accepted', 'dismissed'] as const
export type PlanStatus = (typeof PLAN_STATUSES)[number]

function first<T>(rows: readonly T[]): T {
  const row = rows[0]
  if (!row) throw new Error('insert returned no row')
  return row
}

/** A stored plan by id, workspace-scoped; throws when it is not the caller's. */
export async function getPlanById(db: Db, workspaceId: string, id: string): Promise<PlanRow> {
  const rows = await db
    .select()
    .from(plans)
    .where(and(eq(plans.workspaceId, workspaceId), eq(plans.id, id)))
    .limit(1)
  const row = rows[0]
  if (!row) throw new NotFoundError('plan not found')
  return row
}

/** Reconstruct the labeling-relevant `DayPlan` view from a stored plan row. */
export function planRowToDayPlan(row: PlanRow): DayPlan {
  return {
    dayStartMin: 0,
    dayEndMin: 0,
    blocks: row.blocks,
    plannedFocusMin: row.plannedFocusMin,
    unplacedMin: row.unplacedMin,
    droppedAnchors: row.droppedAnchors,
  }
}

/**
 * The evening review for a plan (REQ-031, #151): plan-vs-actual focus, computed by
 * the deterministic `reviewDayPlan` (ADR-0005). Tracked focus is the total of the
 * day's completed, non-deleted project entries (started on the plan's calendar day,
 * UTC); the drift is `tracked − planned`. Workspace-scoped by construction.
 */
export async function reviewPlan(db: Db, workspaceId: string, id: string): Promise<PlanReview> {
  const row = await getPlanById(db, workspaceId, id)
  const from = new Date(`${row.planDate}T00:00:00.000Z`)
  const to = new Date(from.getTime() + 86_400_000)
  const entries = await db
    .select({ startedAt: timeEntries.startedAt, endedAt: timeEntries.endedAt })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, workspaceId),
        isNotNull(timeEntries.projectId),
        isNotNull(timeEntries.endedAt),
        isNull(timeEntries.deletedAt),
        gte(timeEntries.startedAt, from),
        lt(timeEntries.startedAt, to),
      ),
    )
  const trackedMs = entries.reduce(
    (sum, e) => sum + (e.endedAt === null ? 0 : e.endedAt.getTime() - e.startedAt.getTime()),
    0,
  )
  return reviewDayPlan(planRowToDayPlan(row), Math.round(trackedMs / 60_000))
}

/** The latest plan version for a day, or null. */
export async function getLatestPlan(
  db: Db,
  workspaceId: string,
  date: string,
): Promise<PlanRow | null> {
  const rows = await db
    .select()
    .from(plans)
    .where(and(eq(plans.workspaceId, workspaceId), eq(plans.planDate, date)))
    .orderBy(desc(plans.version))
    .limit(1)
  return rows[0] ?? null
}

/** Generate a plan for a day from the deterministic core and persist it as the next version. */
export async function generatePlan(
  db: Db,
  workspaceId: string,
  userId: string,
  input: { date: string; plan: PlanInput },
): Promise<PlanRow> {
  const dayPlan: DayPlan = buildDayPlan(input.plan)
  const previous = await getLatestPlan(db, workspaceId, input.date)
  const version = (previous?.version ?? 0) + 1
  const rows = await db
    .insert(plans)
    .values({
      workspaceId,
      userId,
      planDate: input.date,
      version,
      status: 'proposed',
      blocks: [...dayPlan.blocks],
      plannedFocusMin: dayPlan.plannedFocusMin,
      unplacedMin: dayPlan.unplacedMin,
      droppedAnchors: [...dayPlan.droppedAnchors],
    })
    .returning()
  return first(rows)
}

// ─── The plan-apply seam (ADR-0071 P4, REQ-070) ────────────────────────────────────────────

/** One durable 🛡 window, as the client reads it back. */
export interface ProtectedTimeRow {
  readonly id: string
  readonly day: string
  readonly startMin: number
  readonly endMin: number
  readonly source: string
}

/**
 * Book a user-confirmed protected window (idempotent: the exact same ws/user/day/start/end
 * window is a no-op rather than a second row, so a double-tap on "confirm" cannot stack
 * shields). Workspace- and user-scoped by construction; only ever called for a proposal the
 * caller confirmed — nothing is auto-booked (ADR-0005).
 */
export async function addProtectedTime(
  db: Db,
  workspaceId: string,
  userId: string,
  window: { day: string; startMin: number; endMin: number },
): Promise<void> {
  const existing = await db
    .select({ id: protectedTimes.id })
    .from(protectedTimes)
    .where(
      and(
        eq(protectedTimes.workspaceId, workspaceId),
        eq(protectedTimes.userId, userId),
        eq(protectedTimes.day, window.day),
        eq(protectedTimes.startMin, window.startMin),
        eq(protectedTimes.endMin, window.endMin),
      ),
    )
    .limit(1)
  if (existing.length > 0) return
  await db.insert(protectedTimes).values({
    workspaceId,
    userId,
    day: window.day,
    startMin: window.startMin,
    endMin: window.endMin,
  })
}

/** The caller's protected windows for one day (for nudge gating + the 🛡 rendering). */
export async function protectedTimesFor(
  db: Db,
  workspaceId: string,
  userId: string,
  day: string,
): Promise<ProtectedTimeRow[]> {
  return db
    .select({
      id: protectedTimes.id,
      day: protectedTimes.day,
      startMin: protectedTimes.startMin,
      endMin: protectedTimes.endMin,
      source: protectedTimes.source,
    })
    .from(protectedTimes)
    .where(
      and(
        eq(protectedTimes.workspaceId, workspaceId),
        eq(protectedTimes.userId, userId),
        eq(protectedTimes.day, day),
      ),
    )
    .orderBy(protectedTimes.startMin)
}

/**
 * Apply a confirmed move/shrink block mutation to a stored plan: the pure `applyProposal`
 * (ADR-0005) mutates the blocks, and the result is persisted as a **new accepted version**
 * (mirroring `generatePlan`'s versioning) so the pre-apply plan stays intact in the history.
 * Workspace-scoped by construction — a foreign plan id reads as not-found; an unknown block id
 * is an honest 400, never a silent no-op.
 */
export async function applyBlockMutation(
  db: Db,
  workspaceId: string,
  userId: string,
  planId: string,
  mutation: PlanBlockMutation,
): Promise<PlanRow> {
  const row = await getPlanById(db, workspaceId, planId)
  const blocks = applyProposal(row.blocks, mutation)
  if (blocks === null) throw new ValidationError('the proposal addresses no block of this plan')
  // A shrink changes planned focus; recompute it from the mutated blocks (code's number).
  const plannedFocusMin = blocks
    .filter(b => b.kind === 'focus')
    .reduce((sum, b) => sum + b.lenMin, 0)
  const previous = await getLatestPlan(db, workspaceId, row.planDate)
  const version = (previous?.version ?? row.version) + 1
  const rows = await db
    .insert(plans)
    .values({
      workspaceId,
      userId,
      planDate: row.planDate,
      version,
      status: 'accepted', // the user confirmed this exact mutation
      blocks,
      plannedFocusMin,
      unplacedMin: row.unplacedMin,
      droppedAnchors: [...row.droppedAnchors],
    })
    .returning()
  return first(rows)
}

/** Accept / dismiss a plan (records the user's response to the proposal). */
export async function setPlanStatus(
  db: Db,
  workspaceId: string,
  id: string,
  status: PlanStatus,
): Promise<PlanRow> {
  if (!PLAN_STATUSES.includes(status)) throw new ValidationError('invalid plan status')
  const rows = await db
    .update(plans)
    .set({ status })
    .where(and(eq(plans.workspaceId, workspaceId), eq(plans.id, id)))
    .returning()
  if (rows.length === 0) throw new NotFoundError('plan not found')
  return first(rows)
}
