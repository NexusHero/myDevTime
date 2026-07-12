import { and, eq, isNull } from 'drizzle-orm'
import type { LocalDb } from './port.js'
import { drizzleFor } from './db.js'
import { rates } from './tables.js'
import { newId, nowIso } from './ids.js'

/**
 * Rate repository (REQ-005). Effective-dated hourly rates, workspace-scoped and
 * tombstone-aware; **no money math** (that is `packages/domain`'s job, ADR-0005).
 * Mirrors the server `rates` table so the ADR-0019 sync engine reconciles the same
 * rows. `effectiveFrom` is an ISO-8601 string here (one timestamp format in the
 * store); the domain layer parses it to an absolute instant when pricing. Queries
 * go through Drizzle (ADR-0046).
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

const cols = {
  id: rates.id,
  workspaceId: rates.workspaceId,
  level: rates.level,
  scopeId: rates.scopeId,
  amountMinorPerHour: rates.amountMinorPerHour,
  effectiveFrom: rates.effectiveFrom,
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
  return drizzleFor(db)
    .select(cols)
    .from(rates)
    .where(and(eq(rates.workspaceId, workspaceId), isNull(rates.deletedAt)))
    .orderBy(rates.level, rates.effectiveFrom)
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
  await drizzleFor(db).insert(rates).values({
    id,
    workspaceId,
    level: input.level,
    scopeId,
    amountMinorPerHour: input.amountMinorPerHour,
    effectiveFrom,
    createdAt: now,
    updatedAt: now,
  })
  return {
    id,
    workspaceId,
    level: input.level,
    scopeId,
    amountMinorPerHour: input.amountMinorPerHour,
    effectiveFrom,
  }
}
