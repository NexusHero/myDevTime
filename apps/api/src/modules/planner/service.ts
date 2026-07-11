import { and, desc, eq, gte, isNotNull, isNull, lt } from 'drizzle-orm'
import {
  buildDayPlan,
  reviewDayPlan,
  type DayPlan,
  type PlanInput,
  type PlanReview,
} from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { plans, timeEntries } from '../../db/schema.js'
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
