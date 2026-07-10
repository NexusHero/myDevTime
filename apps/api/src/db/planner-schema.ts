import { date, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { PlanBlock } from '@mydevtime/domain'
import { workspaces } from './schema.js'
import { user } from './auth-schema.js'

/**
 * Co-Planner plans (REQ-031, ADR-0011): a versioned **plan entity**, distinct from
 * actuals — a proposed day of ghost blocks the user accepts / adjusts / dismisses.
 * Workspace-scoped by construction. The blocks are computed by the deterministic
 * `buildDayPlan` core (ADR-0005) and stored verbatim; a new proposal for a day is
 * a new `version`, so the accept/adjust/dismiss history stays intact.
 */
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  planDate: date('plan_date').notNull(),
  version: integer('version').notNull().default(1),
  // 'proposed' | 'accepted' | 'dismissed'.
  status: text('status').notNull().default('proposed'),
  blocks: jsonb('blocks').$type<PlanBlock[]>().notNull(),
  plannedFocusMin: integer('planned_focus_min').notNull().default(0),
  unplacedMin: integer('unplaced_min').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
