import { pgTable, real, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { workspaces } from './schema.js'
import { user } from './auth-schema.js'

/**
 * Evening Companion / Wellbeing — the per-day load history (REQ-065, design v14 §H, ADR-0005).
 * One row per person per local day: the deterministic `loadScore` that `reviewDay` computed for
 * that day (code's number, never the model's). This is the real, persisted series the longitudinal
 * baseline (`computeBaseline`) is calibrated over — the companion no longer trusts a client-supplied
 * history. Workspace-scoped by construction (ADR-0015): every read/write takes a workspace id.
 *
 * `day` is the local calendar day as `'YYYY-MM-DD'` text (lexicographically ordered = chronological).
 * The unique index on (workspace, user, day) makes re-recording a day an **upsert** — the companion
 * is idempotent across repeated evening opens, so a day counts once in the baseline. Only the load
 * score is persisted here; **mood is deliberately NOT stored** (no consented mood store exists yet —
 * an honest gap, not a guessed zero), so the day review still omits mood until that store lands.
 */
export const wellbeingDays = pgTable(
  'wellbeing_days',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Local calendar day, 'YYYY-MM-DD'. Text so ordering is lexicographic = chronological and
    // weekday derivation stays clock-free (the caller maps the string to a weekday index).
    day: text('day').notNull(),
    // The deterministic composite day-load score from `reviewDay` (one decimal); `real` fits it.
    loadScore: real('load_score').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [uniqueIndex('wellbeing_days_ws_user_day').on(t.workspaceId, t.userId, t.day)],
)
