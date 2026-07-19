import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { connectorGrants, connectorTokens, workspaceMembers, workspaces } from '../../db/schema.js'
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

// Config for the guarded HTTP surface: auth configured, so AuthGuard runs for real
// (401 without a session; a real Better-Auth session for the authenticated cases).
const HTTP_CONFIG = loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) })
const AUTH_PASSWORD = 'sup3r-secret-pw'

type App = Awaited<ReturnType<typeof buildApp>>

function cookieHeader(res: { cookies: readonly { name: string; value: string }[] }): string {
  return res.cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

describe.skipIf(!databaseUrl)('connectors vault + consent (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-conn-a'
  const idB = 'itest-conn-b'
  let wsA = ''
  let wsB = ''

  // Fresh Better-Auth users signed up through the HTTP surface (they need a real
  // account/password to obtain a session cookie — the idA/idB rows have neither).
  const authEmails = ['conn-authz@itest.local', 'conn-preview@itest.local']

  /** Remove a signed-up user and its provisioned workspace (+ any connector rows). */
  async function cleanupAuthUser(email: string): Promise<void> {
    const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, email))
    const u = rows[0]
    if (!u) return
    const members = await db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, u.id))
    for (const m of members) {
      await db.delete(connectorTokens).where(eq(connectorTokens.workspaceId, m.workspaceId))
      await db.delete(connectorGrants).where(eq(connectorGrants.workspaceId, m.workspaceId))
      await db.delete(workspaces).where(eq(workspaces.id, m.workspaceId))
    }
    await db.delete(user).where(eq(user.id, u.id))
  }

  /** Sign a fresh, verified user up through the API and return its session cookie. */
  async function authedCookie(app: App, email: string): Promise<string> {
    await cleanupAuthUser(email)
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { name: 'Conn User', email, password: AUTH_PASSWORD },
    })
    // Simulate the email-verification step so sign-in is allowed.
    await db.update(user).set({ emailVerified: true }).where(eq(user.email, email))
    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email, password: AUTH_PASSWORD },
    })
    return cookieHeader(signIn)
  }

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
    for (const email of authEmails) await cleanupAuthUser(email)
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

  it('Authorize_Unauthenticated_Returns401', async () => {
    const app = await buildApp({ config: HTTP_CONFIG, db: handle })
    const res = await app.inject({
      method: 'GET',
      url: '/api/connectors/google-calendar/authorize',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('Callback_Unauthenticated_Returns401', async () => {
    const app = await buildApp({ config: HTTP_CONFIG, db: handle })
    const res = await app.inject({
      method: 'GET',
      url: '/api/connectors/google-calendar/callback?code=abc&state=xyz',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('Authorize_AuthenticatedButNotConfigured_Returns409WithoutUrl', async () => {
    // No CONNECTOR_GOOGLE_CALENDAR_CLIENT_ID/SECRET in the env → the honest
    // "not configured" path: a 409 conflict, never a 500 and never a fake URL.
    const app = await buildApp({ config: HTTP_CONFIG, db: handle })
    const cookie = await authedCookie(app, 'conn-authz@itest.local')
    const res = await app.inject({
      method: 'GET',
      url: '/api/connectors/google-calendar/authorize',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.statusCode).not.toBe(500)
    expect(res.json()).not.toHaveProperty('url')
    await app.close()
  })

  it('Preview_AuthenticatedWithoutConsent_Returns409', async () => {
    // Consent-first (REQ-025/ADR-0033): a fresh user has granted nothing, so the
    // preview refuses with 409 before any provider work happens.
    const app = await buildApp({ config: HTTP_CONFIG, db: handle })
    const cookie = await authedCookie(app, 'conn-preview@itest.local')
    const res = await app.inject({
      method: 'GET',
      url: '/api/connectors/google-calendar/preview',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('MicrosoftAuthorize_AuthenticatedButNotConfigured_Returns409WithoutUrl', async () => {
    // Microsoft goes through the same env-gated OAuth flow as Google: with no
    // CONNECTOR_MICROSOFT_CALENDAR_CLIENT_ID/SECRET, an honest 409 (never a 500 / fake URL).
    const app = await buildApp({ config: HTTP_CONFIG, db: handle })
    const cookie = await authedCookie(app, 'conn-authz@itest.local')
    const res = await app.inject({
      method: 'GET',
      url: '/api/connectors/microsoft-calendar/authorize',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.statusCode).not.toBe(500)
    expect(res.json()).not.toHaveProperty('url')
    await app.close()
  })

  it('MicrosoftPreview_AuthenticatedWithoutConsent_Returns409', async () => {
    // The generalized `:id/preview` route resolves the Microsoft adapter but still
    // enforces consent-first (REQ-025/ADR-0033): no grant → 409 before any provider work.
    const app = await buildApp({ config: HTTP_CONFIG, db: handle })
    const cookie = await authedCookie(app, 'conn-preview@itest.local')
    const res = await app.inject({
      method: 'GET',
      url: '/api/connectors/microsoft-calendar/preview',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })
})
