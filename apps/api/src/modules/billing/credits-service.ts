import { and, desc, eq, gte, lt, sql } from 'drizzle-orm'
import {
  canDebit,
  creditBalance,
  usageByCategory,
  type CreditEntry as CoreEntry,
  type CreditEntryKind,
  type UsageBucket,
} from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { creditEntries } from '../../db/schema.js'
import { ValidationError } from '../../errors.js'

/**
 * The AI-credit ledger service (REQ-027, ADR-0008), workspace-scoped by
 * construction. The ledger is append-only; the balance and usage are derived by
 * the deterministic core (ADR-0005), never a stored counter. Debits are
 * idempotent on `operationId` — a replay returns the existing entry rather than
 * billing twice — and refused when they would overdraw.
 */
export type CreditEntryRow = typeof creditEntries.$inferSelect

function toCore(row: CreditEntryRow): CoreEntry {
  return {
    kind: row.kind as CreditEntryKind,
    amount: row.amount,
    category: row.category,
    at: row.createdAt.toISOString(),
  }
}

async function allEntries(db: Db, workspaceId: string): Promise<CreditEntryRow[]> {
  return db.select().from(creditEntries).where(eq(creditEntries.workspaceId, workspaceId))
}

/** The current balance (sum of signed deltas), computed by the core. */
export async function balanceFor(db: Db, workspaceId: string): Promise<number> {
  const rows = await allEntries(db, workspaceId)
  return creditBalance(rows.map(toCore))
}

/** The most recent ledger entries, newest first. */
export async function listLedger(
  db: Db,
  workspaceId: string,
  limit = 50,
): Promise<CreditEntryRow[]> {
  return db
    .select()
    .from(creditEntries)
    .where(eq(creditEntries.workspaceId, workspaceId))
    .orderBy(desc(creditEntries.createdAt))
    .limit(limit)
}

/** Credits spent per category over a window (debits only, positive, descending). */
export async function usageFor(
  db: Db,
  workspaceId: string,
  range: { from: Date; to: Date },
): Promise<UsageBucket[]> {
  const rows = await db
    .select()
    .from(creditEntries)
    .where(
      and(
        eq(creditEntries.workspaceId, workspaceId),
        gte(creditEntries.createdAt, range.from),
        lt(creditEntries.createdAt, range.to),
      ),
    )
  return usageByCategory(rows.map(toCore))
}

async function byOperation(
  db: Db,
  workspaceId: string,
  operationId: string,
): Promise<CreditEntryRow | null> {
  const rows = await db
    .select()
    .from(creditEntries)
    .where(
      and(eq(creditEntries.workspaceId, workspaceId), eq(creditEntries.operationId, operationId)),
    )
    .limit(1)
  return rows[0] ?? null
}

async function insertEntry(
  db: Db,
  workspaceId: string,
  values: {
    kind: CreditEntryKind
    amount: number
    category: string
    reason?: string | null | undefined
    operationId?: string | null | undefined
  },
): Promise<CreditEntryRow> {
  const rows = await db
    .insert(creditEntries)
    .values({
      workspaceId,
      kind: values.kind,
      amount: values.amount,
      category: values.category,
      reason: values.reason ?? null,
      operationId: values.operationId ?? null,
    })
    .onConflictDoNothing()
    .returning()
  const inserted = rows[0]
  if (inserted) return inserted
  // Conflict on the idempotency key → the debit was already recorded.
  const existing = values.operationId
    ? await byOperation(db, workspaceId, values.operationId)
    : null
  if (existing) return existing
  throw new Error('credit entry insert returned no row')
}

export interface DebitInput {
  amount: number
  category: string
  reason?: string | null | undefined
  operationId?: string | undefined
}

/** Record a debit (idempotent on `operationId`); refuses to overdraw. */
export async function debit(
  db: Db,
  workspaceId: string,
  input: DebitInput,
): Promise<CreditEntryRow> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ValidationError('debit amount must be a positive integer')
  }
  return db.transaction(async tx => {
    // Serialize concurrent debits for this workspace: without it, two debits read
    // the same balance (READ COMMITTED), both pass canDebit, and both insert —
    // overdrawing below zero. A per-workspace transaction-scoped advisory lock
    // makes the read-check-insert atomic against other debits/grants.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${workspaceId}))`)
    if (input.operationId) {
      const existing = await byOperation(tx, workspaceId, input.operationId)
      if (existing) return existing // replay → no double billing
    }
    const rows = await tx
      .select()
      .from(creditEntries)
      .where(eq(creditEntries.workspaceId, workspaceId))
    if (!canDebit(rows.map(toCore), input.amount)) {
      throw new ValidationError('insufficient credit balance')
    }
    return insertEntry(tx, workspaceId, {
      kind: 'debit',
      amount: -input.amount,
      category: input.category,
      reason: input.reason,
      operationId: input.operationId,
    })
  })
}

export interface GrantInput {
  amount: number
  kind?: 'grant' | 'topup' | undefined
  category: string
  reason?: string | null | undefined
  operationId?: string | undefined
}

/** Record a grant or top-up (positive credits; idempotent on `operationId`). */
export async function grant(
  db: Db,
  workspaceId: string,
  input: GrantInput,
): Promise<CreditEntryRow> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ValidationError('grant amount must be a positive integer')
  }
  return insertEntry(db, workspaceId, {
    kind: input.kind ?? 'grant',
    amount: input.amount,
    category: input.category,
    reason: input.reason,
    operationId: input.operationId,
  })
}
