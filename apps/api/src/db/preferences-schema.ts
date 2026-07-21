import { jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { workspaces } from './schema.js'
import { user } from './auth-schema.js'

/**
 * Per-user, per-workspace preference toggles (M10): the Settings screen's on/off
 * switches (break reminders, calendar sync, auto-tracker, …) plus the Sevi
 * quiet-hours minutes (ADR-0071), stored as a single jsonb blob so adding a
 * setting needs no migration. Workspace-scoped by construction; one row per
 * (workspace, user), upserted on the unique key.
 */
export const userPreferences = pgTable(
  'user_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    prefs: jsonb('prefs').$type<Record<string, boolean | number>>().notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [unique('user_preferences_ws_user').on(table.workspaceId, table.userId)],
)
