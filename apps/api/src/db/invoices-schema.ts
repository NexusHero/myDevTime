import { pgTable, uuid, text, bigint, timestamp } from 'drizzle-orm/pg-core'
import { workspaces } from './schema.js'
import { clients } from './catalog-schema.js'

/**
 * Invoices / "Abrechnungen" (design v6, REQ-005/009). A persisted invoice is the
 * durable record of a billing run: the client, the period, and the frozen totals
 * (hours + money) computed by the deterministic `packages/domain/invoicing` core
 * at issue time. The individual positions are the `time_entries` stamped with
 * this invoice's id (`invoice_id`) — so voiding an invoice just clears those
 * stamps and the hours return to the "open" pool. Amounts are integer minor units
 * of the workspace currency, like the rest of the money layer (ADR-0005).
 */
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  // The billed client; null only for a workspace-wide run (not used by the UI yet).
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  /** Half-open billing window `[period_start, period_end)`. */
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  /** Frozen totals at issue time. */
  totalMs: bigint('total_ms', { mode: 'number' }).notNull(),
  totalMinor: bigint('total_minor', { mode: 'number' }).notNull(),
  currencyCode: text('currency_code').notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
