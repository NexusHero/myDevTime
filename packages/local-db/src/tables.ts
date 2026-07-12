import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { EntityState, SyncEntityType } from '@mydevtime/domain'

/**
 * Drizzle table definitions for the local SQLite schema (ADR-0046). These mirror
 * the DDL in `schema.ts` (`SCHEMA_SQL`, still the runtime `CREATE TABLE` source)
 * **column-for-column**, and are the **typed** layer the repositories query
 * through — so the hand-written `SELECT`/`INSERT` strings and manual row→entity
 * mappers are gone, and column types (booleans as `{ mode: 'boolean' }`, JSON as
 * `{ mode: 'json' }`) are enforced by Drizzle. camelCase keys map to the
 * snake_case columns, so `$inferSelect` matches the exported `Local*` shapes.
 *
 * Only the tables the repositories touch are modelled here; a drift test
 * (`tables.test.ts`) asserts these stay in lock-step with `SCHEMA_SQL`.
 */

export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  version: integer('version').notNull().default(0),
  deletedAt: text('deleted_at'),
  deviceId: text('device_id'),
  operationId: text('operation_id'),
})

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  clientId: text('client_id'),
  name: text('name').notNull(),
  color: text('color'),
  billableDefault: integer('billable_default', { mode: 'boolean' }).notNull().default(true),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  version: integer('version').notNull().default(0),
  deletedAt: text('deleted_at'),
  deviceId: text('device_id'),
  operationId: text('operation_id'),
})

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  billableDefault: integer('billable_default', { mode: 'boolean' }).notNull().default(true),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  version: integer('version').notNull().default(0),
  deletedAt: text('deleted_at'),
  deviceId: text('device_id'),
  operationId: text('operation_id'),
})

export const timeEntries = sqliteTable('time_entries', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  projectId: text('project_id'),
  taskId: text('task_id'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  billable: integer('billable', { mode: 'boolean' }).notNull().default(true),
  source: text('source').notNull().default('timer'),
  note: text('note'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  version: integer('version').notNull().default(0),
  deletedAt: text('deleted_at'),
  deviceId: text('device_id'),
  operationId: text('operation_id'),
})

export const rates = sqliteTable('rates', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  level: text('level').notNull().$type<'workspace' | 'client' | 'project' | 'task'>(),
  scopeId: text('scope_id'),
  amountMinorPerHour: integer('amount_minor_per_hour').notNull(),
  effectiveFrom: text('effective_from').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  version: integer('version').notNull().default(0),
  deletedAt: text('deleted_at'),
  deviceId: text('device_id'),
  operationId: text('operation_id'),
})

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  scope: text('scope').notNull().$type<'project' | 'client'>(),
  scopeId: text('scope_id').notNull(),
  basis: text('basis').notNull().$type<'hours' | 'money'>(),
  limitAmount: integer('limit_amount').notNull(),
  period: text('period').notNull().$type<'total' | 'monthlyRecurring'>(),
  thresholds: text('thresholds', { mode: 'json' }).notNull().$type<number[]>().default([]),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  version: integer('version').notNull().default(0),
  deletedAt: text('deleted_at'),
  deviceId: text('device_id'),
  operationId: text('operation_id'),
})

export const preferences = sqliteTable('preferences', {
  workspaceId: text('workspace_id').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
  version: integer('version').notNull().default(0),
  deviceId: text('device_id'),
  operationId: text('operation_id'),
})

export const syncOutbox = sqliteTable('sync_outbox', {
  opId: text('op_id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  entityType: text('entity_type').notNull().$type<SyncEntityType>(),
  entityId: text('entity_id').notNull(),
  baseVersion: integer('base_version'),
  baseState: text('base_state', { mode: 'json' }).$type<EntityState>(),
  incomingState: text('incoming_state', { mode: 'json' }).notNull().$type<EntityState>(),
  createdAt: text('created_at').notNull(),
})

export const syncState = sqliteTable('sync_state', {
  workspaceId: text('workspace_id').primaryKey(),
  watermark: integer('watermark').notNull().default(0),
  deviceId: text('device_id').notNull(),
})
