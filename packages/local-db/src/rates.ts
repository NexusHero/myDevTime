import type { LocalDb, Row } from './port.js'
import { newId, nowIso } from './ids.js'

/**
 * Rate repository (REQ-005). Effective-dated hourly rates, workspace-scoped and
 * tombstone-aware; **no money math** (that is `packages/domain`'s job, ADR-0005).
 * Mirrors the server `rates` table so the ADR-0019 sync engine reconciles the same
 * rows. `effectiveFrom` is an ISO-8601 string here (one timestamp format in the
 * store); the domain layer parses it to an absolute instant when pricing.
 */
export type RateLevel = 'workspace' | 'client' | 'project' | 'task'

export interface LocalRate {
  readonly id: string
  readonly workspaceId: string
  readonly level: RateLevel
  /** The client/project/task id this rate applies to; `null` for the workspace default. */
  readonly scopeId: string | null
  readonly amountMinorPerHour: number
  /** ISO-8601 instant from which this rate applies (inclusive). */
  readonly effectiveFrom: string
}

function toRate(row: Row): LocalRate {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    level: String(row.level) as RateLevel,
    scopeId: row.scope_id === null ? null : String(row.scope_id),
    amountMinorPerHour: Number(row.amount_minor_per_hour),
    effectiveFrom: String(row.effective_from),
  }
}

export interface CreateRateInput {
  readonly level: RateLevel
  readonly scopeId?: string | null
  readonly amountMinorPerHour: number
  /** ISO-8601 instant; defaults to now. */
  readonly effectiveFrom?: string
  readonly id?: string
}

/** All rates in the workspace, by level then effective date (mirrors the server order). */
export async function listRates(db: LocalDb, workspaceId: string): Promise<LocalRate[]> {
  const rows = await db.getAllAsync(
    `SELECT id, workspace_id, level, scope_id, amount_minor_per_hour, effective_from
       FROM rates
      WHERE workspace_id = ? AND deleted_at IS NULL
      ORDER BY level, effective_from`,
    [workspaceId],
  )
  return rows.map(toRate)
}

export async function createRate(
  db: LocalDb,
  workspaceId: string,
  input: CreateRateInput,
): Promise<LocalRate> {
  const id = input.id ?? newId()
  const now = nowIso()
  // The workspace level is the default and carries no scope; the others name one.
  const scopeId = input.level === 'workspace' ? null : (input.scopeId ?? null)
  const effectiveFrom = input.effectiveFrom ?? now
  await db.runAsync(
    `INSERT INTO rates
       (id, workspace_id, level, scope_id, amount_minor_per_hour, effective_from, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, workspaceId, input.level, scopeId, input.amountMinorPerHour, effectiveFrom, now, now],
  )
  return {
    id,
    workspaceId,
    level: input.level,
    scopeId,
    amountMinorPerHour: input.amountMinorPerHour,
    effectiveFrom,
  }
}
