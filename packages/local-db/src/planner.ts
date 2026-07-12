import type { LocalDb } from './client.js'

export type PlanBlockKind = 'meeting' | 'focus' | 'break'

export interface LocalPlanBlock {
  readonly startMin: number
  readonly lenMin: number
  readonly kind: PlanBlockKind
  readonly label: string
  readonly taskId: string | null
}

export interface LocalPlanAnchorRef {
  readonly startMin: number
  readonly lenMin: number
  readonly label: string
}

export interface LocalDayPlan {
  readonly id: string
  readonly date: string
  readonly version: number
  readonly status: string
  readonly blocks: LocalPlanBlock[]
  readonly plannedFocusMin: number
  readonly unplacedMin: number
  readonly droppedAnchors: LocalPlanAnchorRef[]
}

function rowToPlan(row: Record<string, unknown>): LocalDayPlan {
  return {
    id: row['id'] as string,
    date: row['plan_date'] as string,
    version: row['version'] as number,
    status: row['status'] as string,
    blocks: JSON.parse((row['blocks'] as string) || '[]'),
    plannedFocusMin: row['planned_focus_min'] as number,
    unplacedMin: row['unplaced_min'] as number,
    droppedAnchors: JSON.parse((row['dropped_anchors'] as string) || '[]'),
  }
}

export async function getPlanByDate(db: LocalDb, dateIso: string): Promise<LocalDayPlan | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM plans WHERE plan_date = ? LIMIT 1',
    [dateIso],
  )
  return row ? rowToPlan(row) : null
}

export async function upsertPlan(
  db: LocalDb,
  plan: Omit<LocalDayPlan, 'version'>,
): Promise<LocalDayPlan> {
  const existing = await getPlanByDate(db, plan.date)
  const version = existing ? existing.version + 1 : 1
  const id = existing ? existing.id : plan.id

  await db.runAsync(
    `INSERT INTO plans (
      id, plan_date, version, status, blocks, planned_focus_min, unplaced_min, dropped_anchors
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      blocks = excluded.blocks,
      planned_focus_min = excluded.planned_focus_min,
      unplaced_min = excluded.unplaced_min,
      dropped_anchors = excluded.dropped_anchors,
      version = excluded.version`,
    [
      id,
      plan.date,
      version,
      plan.status,
      JSON.stringify(plan.blocks),
      plan.plannedFocusMin,
      plan.unplacedMin,
      JSON.stringify(plan.droppedAnchors),
    ],
  )

  return { ...plan, id, version }
}

export async function setPlanStatus(db: LocalDb, id: string, status: string): Promise<void> {
  await db.runAsync('UPDATE plans SET status = ?, version = version + 1 WHERE id = ?', [status, id])
}
