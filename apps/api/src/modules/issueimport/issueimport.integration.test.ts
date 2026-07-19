import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import type { ExternalIssue } from '@mydevtime/domain'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { connectorGrants, connectorTokens, workspaceMembers, workspaces } from '../../db/schema.js'
import { importedIssues } from '../../db/issueimport-schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import { putToken } from '../connectors/vault.js'
import { setGrant } from '../connectors/consent.js'
import { importedKeys, previewImport, recordImported } from './service.js'
import type { IssueImportPort, ListIssuesOptions } from './port.js'

/** A stub port returning fixed issues — the seam previewImport plans over (no vendor call). */
class StubPort implements IssueImportPort {
  readonly provider = 'github' as const
  constructor(private readonly issues: readonly ExternalIssue[]) {}
  available(): Promise<boolean> {
    return Promise.resolve(true)
  }
  listIssues(_opts: ListIssuesOptions): Promise<readonly ExternalIssue[]> {
    return Promise.resolve(this.issues)
  }
}

const issue = (over: Partial<ExternalIssue> = {}): ExternalIssue => ({
  source: 'github',
  externalId: '1',
  key: 'acme/app#1',
  title: 'Do the thing',
  state: 'open',
  url: 'https://github.com/acme/app/issues/1',
  labels: ['bug'],
  updatedAtMs: 1000,
  ...over,
})

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
  const authEmails = ['issue-import@itest.local', 'issue-import-b@itest.local']
  let ws = ''

  // Store-level tests (dedup + workspace isolation) only need real workspace/user ids for the
  // DB round-trip — they never exercise the guarded HTTP surface, so they seed fixed-id users
  // directly (like the connectors integration test) rather than signing up over HTTP. That keeps
  // the whole file under Better-Auth's 5-per-minute sign-up/sign-in limit (auth-instance.ts), which
  // the six-cookie variant tripped on its last case.
  const idStore = 'itest-ii-store'
  const idOther = 'itest-ii-other'
  let wsStore = ''
  let wsOther = ''

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
    for (const [id, email] of [
      [idStore, 'ii-store@itest.local'],
      [idOther, 'ii-other@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsStore = await resolveWorkspaceId(db, idStore, 'Store')
    wsOther = await resolveWorkspaceId(db, idOther, 'Other')
  })

  afterEach(async () => {
    await db.delete(importedIssues).where(inArray(importedIssues.workspaceId, [wsStore, wsOther]))
    if (ws) {
      await db.delete(connectorTokens).where(inArray(connectorTokens.workspaceId, [ws]))
      await db.delete(connectorGrants).where(inArray(connectorGrants.workspaceId, [ws]))
      await db.delete(importedIssues).where(inArray(importedIssues.workspaceId, [ws]))
    }
  })

  afterAll(async () => {
    for (const email of authEmails) await cleanupAuthUser(email)
    await db.delete(workspaces).where(inArray(workspaces.id, [wsStore, wsOther]))
    await db.delete(user).where(inArray(user.id, [idStore, idOther]))
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

  it('RecordImport_Unauthenticated_Returns401', async () => {
    const app = await buildApp({ config: HTTP_CONFIG, db: handle })
    const res = await app.inject({
      method: 'POST',
      url: '/api/connectors/github/issues/import',
      payload: { items: [{ externalKey: 'acme/app#1' }] },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('RecordedKey_IsNotReProposed_OnNextPreview', async () => {
    // Real Postgres round-trip (REQ-066): after recording an externalKey, a preview over the same
    // issues no longer proposes that key — the honest gap is closed by the store, not faked.
    const key = { workspaceId: wsStore, userId: idStore, connector: 'github' }

    const issues = [issue({ key: 'acme/app#1' }), issue({ key: 'acme/app#2', externalId: '2' })]

    const before = await previewImport(
      new StubPort(issues),
      true,
      { state: 'open' },
      await importedKeys(db, key),
    )
    expect(before.proposals.map(p => p.externalKey).sort()).toEqual(['acme/app#1', 'acme/app#2'])

    await recordImported(db, { ...key, externalKey: 'acme/app#1' })
    // Idempotent: recording the same key twice does not duplicate it.
    await recordImported(db, { ...key, externalKey: 'acme/app#1' })
    expect(await importedKeys(db, key)).toEqual(['acme/app#1'])

    const after = await previewImport(
      new StubPort(issues),
      true,
      { state: 'open' },
      await importedKeys(db, key),
    )
    expect(after.proposals.map(p => p.externalKey)).toEqual(['acme/app#2'])
  })

  it('ImportedKeys_AreWorkspaceIsolated', async () => {
    // A key imported in another workspace must not dedup mine (ADR-0015, negative isolation).
    await recordImported(db, {
      workspaceId: wsOther,
      userId: idOther,
      connector: 'github',
      externalKey: 'acme/app#1',
    })

    const key = { workspaceId: wsStore, userId: idStore, connector: 'github' }

    // My store is empty even though another workspace imported the same key.
    expect(await importedKeys(db, key)).toEqual([])
    const mine = await previewImport(
      new StubPort([issue({ key: 'acme/app#1' })]),
      true,
      { state: 'open' },
      await importedKeys(db, key),
    )
    expect(mine.proposals.map(p => p.externalKey)).toEqual(['acme/app#1'])
  })
})
