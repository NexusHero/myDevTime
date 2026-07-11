import { boolean, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { workspaces } from './schema.js'
import { user } from './auth-schema.js'
import type { SealedToken } from '../modules/connectors/crypto.js'

/**
 * Connector secrets & consent (M3, ADR-0032/0033). `connector_tokens` holds the
 * sealed OAuth access/refresh tokens — **ciphertext only** (envelope-encrypted,
 * see crypto.ts); plaintext is never stored. `connector_grants` records per-user,
 * per-capability consent (inbound/outbound/capture) so nothing runs without an
 * explicit opt-in. Both are workspace-scoped by construction: one row per
 * (workspace, user, connector[, capability]), enforced by a unique key.
 */
export const connectorTokens = pgTable(
  'connector_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    connector: text('connector').notNull(),
    accessToken: jsonb('access_token').$type<SealedToken>().notNull(),
    refreshToken: jsonb('refresh_token').$type<SealedToken | null>(),
    /** Access-token expiry, so the vault can refresh transparently. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    unique('connector_tokens_ws_user_conn').on(table.workspaceId, table.userId, table.connector),
  ],
)

export const connectorGrants = pgTable(
  'connector_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    connector: text('connector').notNull(),
    // 'inbound' | 'outbound' | 'capture'.
    capability: text('capability').notNull(),
    granted: boolean('granted').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    unique('connector_grants_ws_user_conn_cap').on(
      table.workspaceId,
      table.userId,
      table.connector,
      table.capability,
    ),
  ],
)
