import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { workspaces } from './schema.js'

/**
 * The dev-tool export ledger (REQ-035, ADR-0035): one recorded outcome per confirmed
 * insight/action item pushed toward Jira/Linear/Slack through the narrow `ExportTargetPort`.
 * The ledger is what makes the export **idempotent and auditable**: a `sent` row's
 * `dedupe_key` feeds the runner's seen-set so a re-run never double-posts, and the stored
 * `external_id`/`url` prove where an item landed. `status` mirrors the runner's
 * `ExportOutcome` (`sent | unconfirmed | duplicate | unavailable | failed`) — an
 * unavailable target is recorded honestly, never silently dropped (ADR-0005).
 * Workspace-scoped by construction (ADR-0015).
 */
export const exportRecords = pgTable('export_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  /** The requested destination tool (e.g. `jira`, `linear`, `slack`). */
  target: text('target').notNull(),
  /** Stable per-item key (e.g. `meeting:<id>:action:<n>`) — the idempotency handle. */
  dedupeKey: text('dedupe_key').notNull(),
  /** The runner's recorded `ExportOutcome` for this item. */
  status: text('status').notNull(),
  /** The created item's id in the target tool, when the send succeeded. */
  externalId: text('external_id'),
  url: text('url'),
  /** A human-readable label of what was exported, for the audit view. */
  itemLabel: text('item_label').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
