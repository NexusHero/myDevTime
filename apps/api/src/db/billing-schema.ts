import { pgTable, uuid, text, bigint, integer, timestamp, real, jsonb } from 'drizzle-orm/pg-core'
import { workspaces } from './schema.js'

/**
 * The money layer (REQ-005, ADR-0005): effective-dated hourly rates, budgets,
 * and the threshold alerts a budget emits. All amounts are integer minor units
 * of the workspace currency; the deterministic math lives in
 * `packages/domain/budgets`, this is only its store.
 *
 * `scope_id` is polymorphic (a client / project / task id, or null for the
 * workspace level), so it carries no foreign key — the service scopes every
 * query by `workspace_id`.
 */

export const rates = pgTable('rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  /** 'workspace' | 'client' | 'project' | 'task'. */
  level: text('level').notNull(),
  /** The client/project/task id this rate applies to; null for the workspace default. */
  scopeId: uuid('scope_id'),
  /** Rate in integer minor units per hour. */
  amountMinorPerHour: bigint('amount_minor_per_hour', { mode: 'number' }).notNull(),
  /** Inclusive instant from which this rate applies — effective-dated, non-retroactive. */
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  /** 'project' | 'client'. */
  scope: text('scope').notNull(),
  scopeId: uuid('scope_id').notNull(),
  /** 'hours' | 'money'. */
  basis: text('basis').notNull(),
  /** Cap: milliseconds for hours-based, integer minor units for money-based. */
  limitAmount: bigint('limit_amount', { mode: 'number' }).notNull(),
  /** 'total' | 'monthlyRecurring'. */
  period: text('period').notNull(),
  /** Alert ratios, e.g. [0.8, 1]. */
  thresholds: jsonb('thresholds').$type<number[]>().notNull().default([]),
  /** Thresholds already alerted — persisted for hysteresis (no flapping). */
  firedThresholds: jsonb('fired_thresholds').$type<number[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * A recorded threshold crossing — the event the notification surface consumes
 * (that module lands later; this is the durable outbox it will read).
 */
export const budgetAlerts = pgTable('budget_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  budgetId: uuid('budget_id')
    .notNull()
    .references(() => budgets.id, { onDelete: 'cascade' }),
  /** The threshold that fired (e.g. 0.8). */
  threshold: real('threshold').notNull(),
  /** Consumption ratio at the moment it fired, ×10000 (integer, no float stored). */
  ratioBps: integer('ratio_bps').notNull(),
  firedAt: timestamp('fired_at', { withTimezone: true }).notNull().defaultNow(),
})
