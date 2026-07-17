import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { workspaces } from './schema.js'
import { user } from './auth-schema.js'

/**
 * Partner-light share links (REQ-064, design v17 §F6): a **one-link, free-to-view** grant that
 * lets a partner/family member see *when* the owner is busy — Free/Busy only, never *what*. The
 * link is an opaque, unguessable `token` the invitee visits without an account; the read endpoint
 * resolves it to this row's `workspaceId` and serves only the deterministic Free/Busy projection
 * (`packages/domain/sharing`), so no title/project/note can cross the boundary. `revokedAt` turns
 * a link off without deleting the audit row. Workspace-scoped by construction (ADR-0015).
 */
export const partnerShares = pgTable('partner_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // The opaque link secret the invitee visits — random, unique, unguessable.
  token: text('token').notNull().unique(),
  // Optional human label for the owner's own list ("Anna", "Family").
  label: text('label'),
  // Set when the owner revokes the link; a revoked link resolves to nothing.
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
