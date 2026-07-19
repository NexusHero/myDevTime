import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { connectorGrants, connectorTokens, workspaceMembers, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import { putToken } from '../connectors/vault.js'
import { setGrant } from '../connectors/consent.js'

/**
 * The issue-import preview surface against a REAL Postgres (ADR-0005) — mirrors the connectors
 * preview integration test. Proves the HTTP guard (401 without a session), the consent-first gate
 * (409 before any provider work), and that even with a granted `inbound` + a sealed token the
 * *unconfigured* deployment reports an honest terminal status (`unavailable` — no
 * CONNECTOR_GITHUB_CLIENT_ID/SECRET here) and **writes nothing**. Skips without DATABASE_URL; CI
 * provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

const MASTER_KEY = Buffer.from('0123456789abcdef0123456789abcdef', 'utf8')
const HTTP_CONFIG = loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) })
const AUTH_PASSWORD = 'sup3r-secret-pw'

type App = Awaited<ReturnType<typeof buildApp>>

function cookieHeader(res: { cookies: readonly { name: string; value: string }[] }): string {
  return res.cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

describe.skipIf(!databaseUrl)('issue import preview (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const authEmails = ['issue-import@itest.local']
  let ws = ''

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

  /** Sign a fresh, verified user up through the API and return its session cookie + resolved ids. */
  async function authed(app: App, email: string): Promise<{ cookie: string; userId: string }> {
    await cleanupAuthUser(email)
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { name: 'Issue User', email, password: AUTH_PASSWORD },
    })
    await db.update(user).set({ emailVerified: true }).where(eq(user.email, email))
    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email, password: AUTH_PASSWORD },
    })
    const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, email))
    return { cookie: cookieHeader(signIn), userId: rows[0]!.id }
  }

  beforeAll(async () => {
    for (const email of authEmails) await cleanupAuthUser(email)
  })

  afterEach(async () => {
    if (ws) {
      await db.delete(connectorTokens).where(inArray(connectorTokens.workspaceId, [ws]))
      await db.delete(connectorGrants).where(inArray(connectorGrants.workspaceId, [ws]))
    }
  })

  afterAll(async () => {
    for (const email of authEmails) await cleanupAuthUser(email)
    await handle.close()
  })

  it('Preview_Unauthenticated_Returns401', async () => {
    const app = await buildApp({ config: HTTP_CONFIG, db: handle })
    const res = await app.inject({ method: 'GET', url: '/api/connectors/github/issues/preview' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('Preview_UnknownOrNonIssuesConnector_Returns409', async () => {
    const app = await buildApp({ config: HTTP_CONFIG, db: handle })
    const { cookie } = await authed(app, 'issue-import@itest.local')
    // slack is a known connector but not an issue-import provider → honest 409, not a fake preview.
    const res = await app.inject({
      method: 'GET',
      url: '/api/connectors/slack/issues/preview',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('Preview_AuthenticatedWithoutConsent_Returns409', async () => {
    const app = await buildApp({ config: HTTP_CONFIG, db: handle })
    const { cookie } = await authed(app, 'issue-import@itest.local')
    const res = await app.inject({
      method: 'GET',
      url: '/api/connectors/github/issues/preview',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
    await app.close()
  })

  it('Preview_ConsentedAndConnectedButUnconfigured_Returns409_NotConfigured', async () => {
    // Granted inbound + a sealed token, but no CONNECTOR_GITHUB_CLIENT_ID/SECRET in the env → the
    // token-flow config resolution refuses with an honest 409 (never a fake import, never a 500).
    const app = await buildApp({ config: HTTP_CONFIG, db: handle })
    const { cookie, userId } = await authed(app, 'issue-import@itest.local')
    ws = await resolveWorkspaceId(db, userId, 'Issue User')
    const key = { workspaceId: ws, userId, connector: 'github' }
    await setGrant(db, key, 'inbound', true)
    await putToken(db, MASTER_KEY, key, { accessToken: 'gho_secret_access' })

    const res = await app.inject({
      method: 'GET',
      url: '/api/connectors/github/issues/preview',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.statusCode).not.toBe(500)
    await app.close()
  })
})
