import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { connectorGrants, connectorTokens, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import { deleteToken, getToken, hasToken, putToken } from './vault.js'
import { grantedCapabilities, revokeAllGrants, setGrant } from './consent.js'
import { connectorStatuses } from './service.js'

/**
 * The connector TokenVault + consent seam against a REAL Postgres (REQ-010,
 * ADR-0032/0033) — the acceptance tier the unit tests could not reach. It proves
 * the security-critical promises end-to-end: OAuth tokens are **sealed at rest**
 * (the persisted row never holds the plaintext) yet round-trip through the vault;
 * nothing is "connected" without a stored token and no capability runs without an
 * explicit, stored opt-in; disconnect deletes the token and revokes every grant;
 * and — like every entity — the whole surface is workspace-isolated. Finally the
 * HTTP surface is guarded (401 without a session). Skips without DATABASE_URL; CI
 * provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

// A deterministic 32-byte master key (raw utf-8) — the vault seals under this.
const MASTER_KEY = Buffer.from('0123456789abcdef0123456789abcdef', 'utf8')

describe.skipIf(!databaseUrl)('connectors vault + consent (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-conn-a'
  const idB = 'itest-conn-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'conn-a@itest.local'],
      [idB, 'conn-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    await db.delete(connectorTokens).where(inArray(connectorTokens.workspaceId, [wsA, wsB]))
    await db.delete(connectorGrants).where(inArray(connectorGrants.workspaceId, [wsA, wsB]))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  it('Token_IsSealedAtRestAndRoundTripsThroughTheVault', async () => {
    const key = { workspaceId: wsA, userId: idA, connector: 'github' }
    expect(await hasToken(db, key)).toBe(false)

    await putToken(db, MASTER_KEY, key, {
      accessToken: 'gho_secret_access',
      refreshToken: 'ghr_secret_refresh',
      scopes: ['repo:read'],
    })

    // Connected now, and the vault opens the plaintext back.
    expect(await hasToken(db, key)).toBe(true)
    const opened = await getToken(db, MASTER_KEY, key)
    expect(opened?.accessToken).toBe('gho_secret_access')
    expect(opened?.refreshToken).toBe('ghr_secret_refresh')
    expect(opened?.scopes).toEqual(['repo:read'])

    // But the row on disk holds only ciphertext — the plaintext never persists.
    const [row] = await db
      .select()
      .from(connectorTokens)
      .where(
        and(
          eq(connectorTokens.workspaceId, wsA),
          eq(connectorTokens.userId, idA),
          eq(connectorTokens.connector, 'github'),
        ),
      )
    const raw = JSON.stringify(row?.accessToken)
    expect(raw).not.toContain('gho_secret_access')
    // The row holds a SealedToken envelope (ciphertext), not the plaintext.
    expect(typeof row?.accessToken.ciphertext).toBe('string')
    expect(row?.accessToken.ciphertext).not.toBe('gho_secret_access')
  })

  it('Token_OpeningWithTheWrongMasterKeyFailsTheAeadCheck', async () => {
    const key = { workspaceId: wsA, userId: idA, connector: 'github' }
    await putToken(db, MASTER_KEY, key, { accessToken: 'gho_secret_access' })

    const wrongKey = Buffer.from('ffffffffffffffffffffffffffffffff', 'utf8')
    await expect(getToken(db, wrongKey, key)).rejects.toThrow()
  })

  it('Consent_IsPerCapabilityAndOnlyGrantedOnesCount', async () => {
    const key = { workspaceId: wsA, userId: idA, connector: 'github' }
    await setGrant(db, key, 'inbound', true)
    await setGrant(db, key, 'outbound', false)
    expect(await grantedCapabilities(db, key)).toEqual(['inbound'])

    // Toggling a grant off removes it from the granted set.
    await setGrant(db, key, 'inbound', false)
    expect(await grantedCapabilities(db, key)).toEqual([])
  })

  it('Status_ReportsConnectedAndGrantedCapabilitiesHonestly', async () => {
    const key = { workspaceId: wsA, userId: idA, connector: 'github' }
    await putToken(db, MASTER_KEY, key, { accessToken: 'gho_secret_access' })
    await setGrant(db, key, 'inbound', true)

    const statuses = await connectorStatuses(db, { workspaceId: wsA, userId: idA }, {})
    const github = statuses.find(s => s.id === 'github')
    expect(github?.connected).toBe(true)
    // No CONNECTOR_*_CLIENT_ID in the env → honestly reported as not configured.
    expect(github?.configured).toBe(false)
    const inbound = github?.capabilities.find(c => c.capability === 'inbound')
    expect(inbound?.granted).toBe(true)
  })

  it('Disconnect_DeletesTheTokenAndRevokesEveryGrant', async () => {
    const key = { workspaceId: wsA, userId: idA, connector: 'github' }
    await putToken(db, MASTER_KEY, key, { accessToken: 'gho_secret_access' })
    await setGrant(db, key, 'inbound', true)
    await setGrant(db, key, 'outbound', true)

    // Disconnect = delete sealed tokens + revoke all consent (the controller flow).
    await deleteToken(db, key)
    await revokeAllGrants(db, key)

    expect(await hasToken(db, key)).toBe(false)
    expect(await getToken(db, MASTER_KEY, key)).toBeNull()
    expect(await grantedCapabilities(db, key)).toEqual([])
  })

  it('Vault_IsWorkspaceIsolated', async () => {
    const keyA = { workspaceId: wsA, userId: idA, connector: 'github' }
    await putToken(db, MASTER_KEY, keyA, { accessToken: 'gho_secret_access' })
    await setGrant(db, keyA, 'inbound', true)

    // The other workspace/user sees no token and no grant.
    const keyB = { workspaceId: wsB, userId: idB, connector: 'github' }
    expect(await hasToken(db, keyB)).toBe(false)
    expect(await getToken(db, MASTER_KEY, keyB)).toBeNull()
    expect(await grantedCapabilities(db, keyB)).toEqual([])
    const statusesB = await connectorStatuses(db, { workspaceId: wsB, userId: idB }, {})
    expect(statusesB.find(s => s.id === 'github')?.connected).toBe(false)
  })

  it('ListConnectors_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/connectors' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
