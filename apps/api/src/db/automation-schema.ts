import { boolean, integer, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { RuleAction, RuleMatcher } from '@mydevtime/domain'
import { workspaces } from './schema.js'

/**
 * Categorization rules (REQ-011, ADR-0005): an ordered, versioned set of `matcher → action`
 * rules the deterministic engine (`packages/domain/rules`) evaluates — the first match wins.
 * The matcher and action are stored as typed `jsonb` (the exact `RuleMatcher`/`RuleAction`
 * shapes the pure core reads), so the engine never diverges from what is persisted. Workspace-
 * scoped by construction (ADR-0015); `version` bumps on every edit so `rule:<id>@<version>`
 * provenance pins the exact logic; soft-deleted via `deleted_at`. The engine only ever
 * *proposes* — nothing here books or mutates an entry on its own.
 */
export const rules = pgTable('rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  // Evaluation order — lower runs first; the first match wins (order is intent). `order` is a
  // reserved SQL word, so the column is `eval_order` while the JS field mirrors the domain's `order`.
  order: integer('eval_order').notNull().default(0),
  // Monotonic version — bumped on every edit so provenance pins the exact logic.
  version: integer('version').notNull().default(1),
  matcher: jsonb('matcher').$type<RuleMatcher>().notNull().default({}),
  action: jsonb('action').$type<RuleAction>().notNull().default({}),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})
