import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workspaces } from './schema.js'

/**
 * AI-credit ledger (REQ-027, ADR-0008): an **append-only** log of signed credit
 * deltas — grants/top-ups add, debits subtract — workspace-scoped by construction.
 * The balance is derived by the deterministic core (`packages/domain/credits`),
 * never a mutable counter. `operation_id` makes a debit **idempotent**: a partial
 * unique index rejects a replay so an AI action is billed at most once.
 */
export const creditEntries = pgTable(
  'credit_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    // 'grant' | 'topup' | 'debit' | 'expiry' | 'adjustment'.
    kind: text('kind').notNull(),
    // Signed integer credits: grants/top-ups > 0, debits/expiries < 0.
    amount: integer('amount').notNull(),
    category: text('category').notNull(),
    reason: text('reason'),
    // Client-supplied idempotency key (per workspace); null for server grants.
    operationId: text('operation_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    uniqueIndex('credit_entries_op_idem')
      .on(t.workspaceId, t.operationId)
      .where(sql`${t.operationId} is not null`),
  ],
)
