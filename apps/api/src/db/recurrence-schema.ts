import { date, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { workspaces } from './schema.js'
import { user } from './auth-schema.js'

/**
 * Recurring entries (REQ-060, design v17 §F4): a **series** — one stored rule that projects
 * occurrences across days, distinct from the per-day plan. A series is a core feature for every
 * entry type (a daily standup, a weekday commute), so `kind` is open. Workspace-scoped by
 * construction (ADR-0015). The occurrence dates are computed by the deterministic
 * `expandRecurrence` core (ADR-0005) at read time — no per-occurrence rows — from the anchor
 * date and the (freq, end) rule stored here as plain columns.
 */
export const recurringEntries = pgTable('recurring_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // 'meeting' | 'focus' | 'break' | 'life' — the entry kind the series produces.
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  // The first occurrence, `YYYY-MM-DD`; expansion advances from here.
  anchorDate: date('anchor_date').notNull(),
  // Minute-of-day the occurrence starts, and its length in minutes.
  startMin: integer('start_min').notNull(),
  lenMin: integer('len_min').notNull(),
  // 'daily' (weekdays) | 'weekly' | 'monthly' — a series always repeats (never 'none').
  freq: text('freq').notNull(),
  // 'never' | 'until' | 'count' — with its bound in `untilDate` / `count`.
  endKind: text('end_kind').notNull().default('never'),
  untilDate: date('until_date'),
  count: integer('count'),
  // Optional project for the produced occurrences (categorization stays a later step).
  projectId: uuid('project_id'),
  // Optional planning metadata for a hand-created entry (design v19 New-Entry dialog): the
  // task priority (1 = high · 2 = med · 3 = low) and a free-text note. Null for entries that
  // carry neither (e.g. a synced meeting). Occurrences surface these so the Month view can
  // show a real priority dot instead of a default (ADR-0005 — nothing is invented).
  priority: integer('priority'),
  note: text('note'),
  // Meeting detail (REQ-075, issue #375): where it is, who is in it, how to join it — the three
  // things that make a meeting a meeting. All nullable: a focus block or a break has none, and an
  // absent value renders as absent, never as a placeholder. `attendees` is personal data belonging
  // to third parties, so it is never exposed by the Free/Busy share path (REQ-064).
  location: text('location'),
  attendees: jsonb('attendees').$type<MeetingAttendee[]>(),
  conferenceUrl: text('conference_url'),
  // A human provider label, e.g. `Teams` / `Meet` — shown beside the join action.
  conferenceProvider: text('conference_provider'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** One invited person. `email` and `response` are absent when the source did not supply them. */
export interface MeetingAttendee {
  readonly name: string
  readonly email?: string | undefined
  readonly response?: 'accepted' | 'tentative' | 'declined' | 'needsAction' | undefined
}
