import { and, eq } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { connectorTokens } from '../../db/schema.js'
import { openToken, sealToken } from './crypto.js'

/**
 * The connector TokenVault (M3, ADR-0032): the narrow surface a connector feature
 * uses to store and read a user's OAuth tokens. Tokens are **sealed** (envelope
 * encryption + AEAD, crypto.ts) before they touch the DB and opened only here —
 * nothing upstream sees a plaintext token or a crypto type. Workspace-isolated by
 * construction: every query is keyed by (workspaceId, userId, connector).
 */
export interface StoreTokenInput {
  readonly accessToken: string
  readonly refreshToken?: string | null
  readonly expiresAt?: Date | null
  readonly scopes?: readonly string[]
}

export interface OpenedToken {
  readonly accessToken: string
  readonly refreshToken: string | null
  readonly expiresAt: Date | null
  readonly scopes: readonly string[]
}

/** Store (upsert) a user's sealed tokens for a connector. Plaintext never persists. */
export async function putToken(
  db: Db,
  masterKey: Buffer,
  key: { workspaceId: string; userId: string; connector: string },
  input: StoreTokenInput,
): Promise<void> {
  const values = {
    ...key,
    accessToken: sealToken(masterKey, input.accessToken),
    refreshToken:
      input.refreshToken === undefined || input.refreshToken === null
        ? null
        : sealToken(masterKey, input.refreshToken),
    expiresAt: input.expiresAt ?? null,
    scopes: [...(input.scopes ?? [])],
    updatedAt: new Date(),
  }
  await db
    .insert(connectorTokens)
    .values(values)
    .onConflictDoUpdate({
      target: [connectorTokens.workspaceId, connectorTokens.userId, connectorTokens.connector],
      set: {
        accessToken: values.accessToken,
        refreshToken: values.refreshToken,
        expiresAt: values.expiresAt,
        scopes: values.scopes,
        updatedAt: values.updatedAt,
      },
    })
}

/** Open (decrypt) a user's tokens for a connector, or null when none are stored. */
export async function getToken(
  db: Db,
  masterKey: Buffer,
  key: { workspaceId: string; userId: string; connector: string },
): Promise<OpenedToken | null> {
  const rows = await db
    .select()
    .from(connectorTokens)
    .where(
      and(
        eq(connectorTokens.workspaceId, key.workspaceId),
        eq(connectorTokens.userId, key.userId),
        eq(connectorTokens.connector, key.connector),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (row === undefined) return null
  return {
    accessToken: openToken(masterKey, row.accessToken),
    refreshToken: row.refreshToken === null ? null : openToken(masterKey, row.refreshToken),
    expiresAt: row.expiresAt,
    scopes: row.scopes,
  }
}

/** Whether a connector is connected for a user (a token exists) — no decryption. */
export async function hasToken(
  db: Db,
  key: { workspaceId: string; userId: string; connector: string },
): Promise<boolean> {
  const rows = await db
    .select({ id: connectorTokens.id })
    .from(connectorTokens)
    .where(
      and(
        eq(connectorTokens.workspaceId, key.workspaceId),
        eq(connectorTokens.userId, key.userId),
        eq(connectorTokens.connector, key.connector),
      ),
    )
    .limit(1)
  return rows.length > 0
}

/** Disconnect: delete the sealed tokens for a connector (the vault half of revoke). */
export async function deleteToken(
  db: Db,
  key: { workspaceId: string; userId: string; connector: string },
): Promise<void> {
  await db
    .delete(connectorTokens)
    .where(
      and(
        eq(connectorTokens.workspaceId, key.workspaceId),
        eq(connectorTokens.userId, key.userId),
        eq(connectorTokens.connector, key.connector),
      ),
    )
}
