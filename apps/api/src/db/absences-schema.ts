import {
  boolean,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { workspaces } from './schema.js'
import { user } from './auth-schema.js'

/**
 * Absences (REQ-029, ADR-0010): vacation / sick / holiday / custom leave as
 * inclusive calendar-date ranges, plus the per-workspace vacation policy the
 * balance is measured against. Workspace-scoped by construction. Dates are stored
 * as plain calendar days (no zone) so the deterministic core
 * (`packages/domain/absences`) counts them exactly.
 */
export const absences = pgTable('absences', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // 'vacation' | 'sick' | 'holiday' | 'other'.
  kind: text('kind').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  halfDay: boolean('half_day').notNull().default(false),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** One vacation policy per workspace: annual allowance + carried-over days. */
export const absencePolicies = pgTable(
  'absence_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    annualAllowanceDays: integer('annual_allowance_days').notNull().default(30),
    carryOverDays: integer('carry_over_days').notNull().default(0),
    // Public-holiday region for this workspace (e.g. 'DE-BW', 'CH-BS'); null = none.
    region: text('region'),
  },
  t => [uniqueIndex('absence_policies_one_per_ws').on(t.workspaceId)],
)
