import { pgTable, uuid, text, boolean, bigint, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workspaces } from './schema.js'
import { user } from './auth-schema.js'
import { projects, tasks } from './catalog-schema.js'

/**
 * Time entries (REQ-004) — the raw record of tracked time, both live (a running
 * timer) and after the fact (manual). Workspace-scoped by construction; a
 * running timer is simply a row with `ended_at IS NULL` and a persisted
 * `started_at`, so it survives app kill / reboot (the elapsed clock is derived,
 * never ticked state). Every entry carries `source` provenance (ADR-0005).
 *
 * The partial unique index enforces **at most one running timer per workspace**
 * at the database level; the service stops the previous timer before starting a
 * new one, so the invariant holds even under a race.
 */
export const timeEntries = pgTable(
  'time_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    // null while the timer is running.
    endedAt: timestamp('ended_at', { withTimezone: true }),
    billable: boolean('billable').notNull().default(true),
    source: text('source').notNull(),
    note: text('note'),
    // Invoicing (design v6, REQ-005): set when this entry is included in an issued
    // invoice, so it leaves the "open billable" pool. Voiding the invoice clears
    // both. `invoice_id` has no hard FK — the FK would create a schema cycle with
    // invoices → clients → …; the service scopes every query by workspace_id.
    invoiceId: uuid('invoice_id'),
    invoicedAt: timestamp('invoiced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    // Sync metadata (REQ-006, ADR-0019): monotonic version stamped by a DB
    // trigger; deleted_at is the tombstone so deletions propagate.
    version: bigint('version', { mode: 'number' }).notNull().default(0),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  t => [
    // At most one *live* running timer per workspace (a tombstoned row is exempt).
    uniqueIndex('time_entries_one_running_per_ws')
      .on(t.workspaceId)
      .where(sql`${t.endedAt} is null and ${t.deletedAt} is null`),
  ],
)
