import { afterAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'

/**
 * Auth module against a REAL Postgres (SKILL §3.3). Skips without DATABASE_URL so
 * the local gate stays DB-free; CI provides a `postgres` service that has run the
 * migrations. Exercises the acceptance-critical behaviour and the ADR-0017 gate
 * that Better-Auth's schema coexists with the workspace isolation root.
 */
const databaseUrl = process.env.DATABASE_URL
const config = loadConfig({
  LOG_LEVEL: 'silent',
  AUTH_SECRET: 'integration-test-secret-'.padEnd(32, 'x'),
})

async function post(
  app: FastifyInstance,
  url: string,
  payload: Record<string, unknown>,
  cookie?: string,
) {
  return app.inject({ method: 'POST', url, payload, ...(cookie ? { headers: { cookie } } : {}) })
}

function cookieHeader(res: { cookies: readonly { name: string; value: string }[] }): string {
  return res.cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

describe.skipIf(!databaseUrl)('auth module (integration)', () => {
  const handle = createDb(databaseUrl!)

  afterAll(async () => {
    await handle.close()
  })

  it('SignUpEmail_NewUser_CreatesUnverifiedUser', async () => {
    const app = await buildApp({ config, db: handle })
    const email = 'signup@example.test'
    await handle.db.delete(user).where(eq(user.email, email))

    const res = await post(app, '/api/auth/sign-up/email', {
      name: 'Sign Up',
      email,
      password: 'sup3r-secret-pw',
    })

    expect(res.statusCode).toBe(200)
    const rows = await handle.db.select().from(user).where(eq(user.email, email))
    expect(rows).toHaveLength(1)
    // requireEmailVerification: a fresh account is unverified until it verifies.
    expect(rows[0]?.emailVerified).toBe(false)

    await handle.db.delete(user).where(eq(user.email, email))
    await app.close()
  })

  it('VerifiedUser_SignsInThenGetMe_ReturnsIdentity', async () => {
    const app = await buildApp({ config, db: handle })
    const email = 'login@example.test'
    const password = 'sup3r-secret-pw'
    await handle.db.delete(user).where(eq(user.email, email))

    await post(app, '/api/auth/sign-up/email', { name: 'Login User', email, password })
    // Simulate the email verification step so sign-in is allowed.
    await handle.db.update(user).set({ emailVerified: true }).where(eq(user.email, email))

    const signIn = await post(app, '/api/auth/sign-in/email', { email, password })
    expect(signIn.statusCode).toBe(200)
    const cookie = cookieHeader(signIn)
    expect(cookie.length).toBeGreaterThan(0)

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    expect(me.statusCode).toBe(200)
    expect(me.json()).toMatchObject({ email, emailVerified: true })

    // Sign-out revokes the session (logout) — the same cookie no longer works.
    const signOut = await post(app, '/api/auth/sign-out', {}, cookie)
    expect(signOut.statusCode).toBe(200)
    const meAfter = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    expect(meAfter.statusCode).toBe(401)

    await handle.db.delete(user).where(eq(user.email, email))
    await app.close()
  })

  it('SignInEmail_TooManyAttempts_RateLimited429', async () => {
    const app = await buildApp({ config, db: handle })
    const email = 'ratelimit@example.test'

    // customRules: /sign-in/email is window 60s / max 5. The 6th attempt trips it.
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await post(app, '/api/auth/sign-in/email', { email, password: 'wrong-pw' })
      statuses.push(res.statusCode)
    }

    expect(statuses).toContain(429)
    await app.close()
  })

  it('AuthSchema_CoexistsWithWorkspaceRoot', async () => {
    // ADR-0017 gate #1 (smoke): identity tables and the workspace isolation root
    // live in the same database and are both writable/queryable — no collision.
    const inserted = await handle.db.insert(workspaces).values({ name: 'Coexist WS' }).returning()
    const created = inserted[0]
    expect(created?.id).toBeDefined()

    const anyUsers = await handle.db.select().from(user).limit(1)
    expect(Array.isArray(anyUsers)).toBe(true)

    if (created) await handle.db.delete(workspaces).where(eq(workspaces.id, created.id))
  })
})
