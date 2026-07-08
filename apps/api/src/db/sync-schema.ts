import { pgTable, uuid, text, timestamp, boolean, primaryKey } from 'drizzle-orm/pg-core'
import { workspaces } from './schema.js'

/**
 * Sync bookkeeping (REQ-006, ADR-0019).
 *
 * `sync_operations` records every applied push operation id per workspace, so a
 * re-delivered push is an idempotent no-op — the engine never double-applies.
 *
 * `sync_conflicts` persists a surfaced conflict (a time-entry interval collision
 * or delete-vs-edit) so the losing version is never lost: the authoritative row
 * keeps the server value while the competing `incoming` snapshot waits here for
 * the user to resolve.
 */

export const syncOperations = pgTable(
  'sync_operations',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    opId: text('op_id').notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [primaryKey({ columns: [t.workspaceId, t.opId] })],
)

export const syncConflicts = pgTable('sync_conflicts', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  /** JSON array of the conflicting field names. */
  fields: text('fields').notNull(),
  /** JSON of the competing incoming EntityState, preserved for review. */
  incoming: text('incoming').notNull(),
  resolved: boolean('resolved').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
