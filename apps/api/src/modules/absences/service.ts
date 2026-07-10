import { and, eq, gte, lte } from 'drizzle-orm'
import {
  vacationBalance,
  type Absence as CoreAbsence,
  type AbsenceKind,
  type VacationBalance,
} from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { absencePolicies, absences } from '../../db/schema.js'
import { NotFoundError } from '../../errors.js'

/**
 * Absence persistence (REQ-029, ADR-0010): leave ranges + the per-workspace
 * vacation policy, workspace-scoped by construction. The service stores rows and
 * hands them to the deterministic `vacationBalance` core; no allowance arithmetic
 * happens here (ADR-0005).
 */

export type AbsenceRow = typeof absences.$inferSelect
export type PolicyRow = typeof absencePolicies.$inferSelect

const DEFAULT_POLICY = { annualAllowanceDays: 30, carryOverDays: 0 }

function first<T>(rows: readonly T[]): T {
  const row = rows[0]
  if (!row) throw new Error('insert returned no row')
  return row
}

function toCore(row: AbsenceRow): CoreAbsence {
  return {
    kind: row.kind as AbsenceKind,
    startDate: row.startDate,
    endDate: row.endDate,
    halfDay: row.halfDay,
  }
}

export interface CreateAbsenceInput {
  kind: AbsenceKind
  startDate: string
  endDate: string
  halfDay?: boolean | undefined
  note?: string | null | undefined
}

/** Record an absence for the caller's workspace. */
export async function createAbsence(
  db: Db,
  workspaceId: string,
  userId: string,
  input: CreateAbsenceInput,
): Promise<AbsenceRow> {
  const rows = await db
    .insert(absences)
    .values({
      workspaceId,
      userId,
      kind: input.kind,
      startDate: input.startDate,
      endDate: input.endDate,
      halfDay: input.halfDay ?? false,
      note: input.note ?? null,
    })
    .returning()
  return first(rows)
}

/** List absences overlapping `[from, to]` (inclusive calendar dates), earliest first. */
export async function listAbsences(
  db: Db,
  workspaceId: string,
  range: { from: string; to: string },
): Promise<AbsenceRow[]> {
  return db
    .select()
    .from(absences)
    .where(
      and(
        eq(absences.workspaceId, workspaceId),
        lte(absences.startDate, range.to),
        gte(absences.endDate, range.from),
      ),
    )
    .orderBy(absences.startDate)
}

/** Delete an absence in the caller's workspace. */
export async function deleteAbsence(db: Db, workspaceId: string, id: string): Promise<void> {
  const rows = await db
    .delete(absences)
    .where(and(eq(absences.workspaceId, workspaceId), eq(absences.id, id)))
    .returning({ id: absences.id })
  if (rows.length === 0) throw new NotFoundError('absence not found')
}

/** The workspace's vacation policy, or the default when none is set. */
export async function getPolicy(
  db: Db,
  workspaceId: string,
): Promise<PolicyRow | typeof DEFAULT_POLICY> {
  const rows = await db
    .select()
    .from(absencePolicies)
    .where(eq(absencePolicies.workspaceId, workspaceId))
    .limit(1)
  return rows[0] ?? DEFAULT_POLICY
}

export interface SetPolicyInput {
  annualAllowanceDays: number
  carryOverDays: number
}

/** Upsert the workspace's vacation policy (one row per workspace). */
export async function setPolicy(
  db: Db,
  workspaceId: string,
  input: SetPolicyInput,
): Promise<PolicyRow> {
  const rows = await db
    .insert(absencePolicies)
    .values({
      workspaceId,
      annualAllowanceDays: input.annualAllowanceDays,
      carryOverDays: input.carryOverDays,
    })
    .onConflictDoUpdate({
      target: absencePolicies.workspaceId,
      set: {
        annualAllowanceDays: input.annualAllowanceDays,
        carryOverDays: input.carryOverDays,
      },
    })
    .returning()
  return first(rows)
}

/** The vacation-allowance balance for a calendar year (deterministic core). */
export async function balanceForYear(
  db: Db,
  workspaceId: string,
  year: number,
): Promise<VacationBalance> {
  const from = `${String(year).padStart(4, '0')}-01-01`
  const to = `${String(year).padStart(4, '0')}-12-31`
  const rows = await listAbsences(db, workspaceId, { from, to })
  const policy = await getPolicy(db, workspaceId)
  return vacationBalance(rows.map(toCore), {
    annualAllowanceDays: policy.annualAllowanceDays,
    carryOverDays: policy.carryOverDays,
  })
}
