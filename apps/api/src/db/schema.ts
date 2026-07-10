import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * First schema stub — the workspace is the isolation root (REQ-001): every
 * tenant-scoped entity added by later issues carries a non-optional
 * `workspaceId` foreign key into this table. Auth, tracking, etc. extend the
 * schema from their own modules; this file is the shared source of truth
 * `drizzle-kit` reads to generate migrations.
 */
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // One workspace currency at 1.0 (multi-currency is backlog) — ISO 4217 code.
  // All money on the deterministic path is integer minor units of this currency.
  currencyCode: text('currency_code').notNull().default('EUR'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert

// Better-Auth identity tables (user/session/account/verification) live alongside
// the workspace root and are picked up by drizzle-kit + the db client from here.
export * from './auth-schema.js'

// Workspace catalog: clients → projects → tasks, tags, membership (REQ-001).
export * from './catalog-schema.js'

// Time entries: timers + manual entries, workspace-scoped (REQ-004).
export * from './entries-schema.js'

// Sync bookkeeping: idempotency ledger + surfaced conflicts (REQ-006).
export * from './sync-schema.js'

// Money: effective-dated rates, budgets, threshold alerts (REQ-005).
export * from './billing-schema.js'

// Entitlements: provider-agnostic event log; plan derived on read (REQ-016).
export * from './entitlements-schema.js'

// Attendance: work-day shifts + effective-dated target-hour schedules (REQ-028).
export * from './attendance-schema.js'

// Absences: leave ranges + per-workspace vacation policy (REQ-029).
export * from './absences-schema.js'
