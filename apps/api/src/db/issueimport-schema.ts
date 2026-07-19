import { pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { workspaces } from './schema.js'
import { user } from './auth-schema.js'

/**
 * Imported-issue links (REQ-066, ADR-0005): the store of which external tickets a user has
 * already imported from a tracker, so a subsequent preview does not re-propose them. Each row is
 * a link only — it records the ticket's `externalKey` and (optionally) the `taskId` the client
 * created for it via the tracking endpoint; **it never holds or creates a task**, keeping the
 * import proposal-only. Workspace- **and** user-scoped by construction (ADR-0015): one row per
 * (workspace, user, connector, externalKey), enforced by a unique key so importing the same ticket
 * twice is idempotent. `taskId` is a soft reference (no cascade) so the dedup record survives a
 * task deletion — a re-import stays intentional, never accidental.
 */
export const importedIssues = pgTable(
  'imported_issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    connector: text('connector').notNull(),
    /** The ticket's human ref (`ExternalIssue.key`) — the dedup handle. */
    externalKey: text('external_key').notNull(),
    /** The task the client created for this ticket, when it recorded one — a soft link, no FK. */
    taskId: uuid('task_id'),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    unique('imported_issues_ws_user_conn_key').on(
      table.workspaceId,
      table.userId,
      table.connector,
      table.externalKey,
    ),
  ],
)
