import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  bigint,
  timestamp,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workspaces } from './schema.js'
import { user } from './auth-schema.js'

/**
 * The workspace catalog (REQ-001, ADR-0002): the Tyme-style hierarchy
 * clients → projects → tasks, plus tags. Every tenant entity carries a
 * non-optional `workspace_id` into the isolation root — workspace isolation by
 * construction. Archiving is a soft flag: rows stay for history, disappear from
 * pickers, and block new children (enforced in the service layer).
 */

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

/**
 * Sync metadata (REQ-006, ADR-0019) carried by every syncable entity:
 * `version` is a per-database monotonic counter stamped by a DB trigger on every
 * insert/update (so it is a storage invariant, independent of which code writes),
 * and `deleted_at` is the tombstone — deletions soft-delete so they can sync.
 * The default of `0` only lets Drizzle omit `version` on insert; the trigger
 * immediately overwrites it with the next sequence value.
 */
const syncColumns = {
  version: bigint('version', { mode: 'number' }).notNull().default(0),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}

/**
 * Membership links a user to a workspace. One personal workspace per user at
 * 1.0; the join table leaves room for shared workspaces later.
 */
export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('owner'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [primaryKey({ columns: [t.workspaceId, t.userId] })],
)

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  archived: boolean('archived').notNull().default(false),
  ...timestamps,
  ...syncColumns,
})

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  // A project belongs to at most one client; null = internal/no client.
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  color: text('color'),
  billableDefault: boolean('billable_default').notNull().default(true),
  // Rate override slot; the rate values themselves land in the budgets issue (#10).
  hourlyRateOverride: numeric('hourly_rate_override'),
  archived: boolean('archived').notNull().default(false),
  ...timestamps,
  ...syncColumns,
})

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  // A task belongs to exactly one project.
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  billableDefault: boolean('billable_default').notNull().default(true),
  archived: boolean('archived').notNull().default(false),
  ...timestamps,
  ...syncColumns,
})

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    archived: boolean('archived').notNull().default(false),
    ...timestamps,
    ...syncColumns,
  },
  // Partial: a soft-deleted tag frees its name for reuse (sync tombstones live on).
  t => [
    uniqueIndex('tags_workspace_name_uq')
      .on(t.workspaceId, t.name)
      .where(sql`${t.deletedAt} is null`),
  ],
)
