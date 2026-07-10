import { bigint, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workspaces } from './schema.js'
import { user } from './auth-schema.js'

/**
 * Attendance (REQ-028, ADR-0010): the work day itself — clock-in/out with breaks
 * — recorded alongside project time, and the effective-dated target-hour schedule
 * the overtime balance is measured against. Workspace-scoped by construction. All
 * the arithmetic (net worked time, overtime) lives in the deterministic core
 * (`packages/domain/attendance`); these tables are only the record.
 *
 * A shift is a punch pair: `started_at` set, `ended_at` null while the clock is
 * still running (the elapsed time is derived, never ticked). The partial unique
 * index enforces **at most one open shift per workspace** at the DB level, the
 * same reboot-safe invariant the running timer uses.
 */
export const attendanceShifts = pgTable(
  'attendance_shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    // null while the shift is still open (clocked in, not yet out).
    endedAt: timestamp('ended_at', { withTimezone: true }),
    // Total break time within the shift, milliseconds.
    breakMs: bigint('break_ms', { mode: 'number' }).notNull().default(0),
    source: text('source').notNull().default('manual'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    uniqueIndex('attendance_shifts_one_open_per_ws')
      .on(t.workspaceId)
      .where(sql`${t.endedAt} is null`),
  ],
)

/**
 * Effective-dated weekly target-hour schedule. `weekly_target_ms` is a 7-element
 * array of target milliseconds per ISO weekday, Monday first (`[Mon…Sun]`); the
 * overtime balance for a window uses the schedule in effect at that window. New
 * schedules are appended (never edited) so history stays intact.
 */
export const workSchedules = pgTable('work_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  weeklyTargetMs: jsonb('weekly_target_ms').$type<number[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
