import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { userPreferences, workspaceMembers, workspaces } from '../../db/schema.js'
import { wellbeingMoods } from '../../db/wellbeing-schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import { setPreferences } from '../preferences/service.js'
import * as svc from './service.js'

/**
 * The consented mood store against a REAL Postgres (ADR-0071 P3, REQ-068). The critical
 * property is consent-first *by the server*: without the stored `moodConsent` preference a
 * POST is an honest 409 (RFC 7807) and — verified via a direct read — **nothing** is stored.
 * With consent the write persists and is idempotent per day (the last word wins), the history
 * reads back newest-first, one DELETE wipes everything, and — like every entity — the store is
 * workspace-isolated (negative isolation). The HTTP cases sign one real user up through
 * Better-Auth (mirrors the issue-import suite, staying under the sign-up rate limit); the
 * store-level cases seed fixed-id users directly. Skips without DATABASE_URL; CI provides
 * Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

const HTTP_CONFIG = loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) })
const AUTH_PASSWORD = 'sup3r-secret-pw'
const AUTH_EMAIL = 'mood-http@itest.local'

type App = Awaited<ReturnType<typeof buildApp>>

function cookieHeader(res: { cookies: readonly { name: string; value: string }[] }): string {
  return res.cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

describe.skipIf(!databaseUrl)('wellbeing mood store (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-mood-a'
  const idB = 'itest-mood-b'
  let wsA = ''
  let wsB = ''
  // The HTTP user's ids, resolved once it is signed up (cleaned again in afterAll).
  let httpUserId = ''
  let httpWs = ''

  async function cleanupAuthUser(email: string): Promise<void> {
    const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, email))
    const u = rows[0]
    if (!u) return
    const members = await db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, u.id))
    for (const m of members) {
      await db.delete(workspaces).where(eq(workspaces.id, m.workspaceId))
    }
    await db.delete(user).where(eq(user.id, u.id))
  }

  /** Sign the HTTP test user up through the API and return its session cookie. */
  async function authed(app: App): Promise<string> {
    await cleanupAuthUser(AUTH_EMAIL)
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { name: 'Mood User', email: AUTH_EMAIL, password: AUTH_PASSWORD },
    })
    await db.update(user).set({ emailVerified: true }).where(eq(user.email, AUTH_EMAIL))
    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: AUTH_EMAIL, password: AUTH_PASSWORD },
    })
    const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, AUTH_EMAIL))
    httpUserId = rows[0]!.id
    httpWs = await resolveWorkspaceId(db, httpUserId, 'Mood User')
    return cookieHeader(signIn)
  }

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'mood-a@itest.local'],
      [idB, 'mood-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    const scopes = [wsA, wsB, ...(httpWs ? [httpWs] : [])]
    await db.delete(wellbeingMoods).where(inArray(wellbeingMoods.workspaceId, scopes))
    await db.delete(userPreferences).where(inArray(userPreferences.workspaceId, scopes))
  })

  afterAll(async () => {
    await cleanupAuthUser(AUTH_EMAIL)
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  it('PostMood_Unauthenticated_Returns401', async () => {
    const app = await buildApp({ config: HTTP_CONFIG, db: handle })
    const res = await app.inject({
      method: 'POST',
      url: '/api/wellbeing/mood',
      payload: { mood: 'good' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('LoadHistory_Unauthenticated_Returns401', async () => {
    const app = await buildApp({ config: HTTP_CONFIG, db: handle })
    const res = await app.inject({ method: 'GET', url: '/api/wellbeing/load-history?days=30' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('MoodOverHttp_ConsentGatedThenFullLifecycle', async () => {
    const app = await buildApp({ config: HTTP_CONFIG, db: handle })
    const cookie = await authed(app)

    // Without consent: an honest RFC 7807 409, and NOTHING was stored (direct read).
    const denied = await app.inject({
      method: 'POST',
      url: '/api/wellbeing/mood',
      headers: { cookie },
      payload: { mood: 'stressed', day: '2026-07-20' },
    })
    expect(denied.statusCode).toBe(409)
    expect(denied.json()).toMatchObject({ status: 409, title: 'Conflict' })
    expect(await svc.moodHistory(db, { workspaceId: httpWs, userId: httpUserId }, 30)).toEqual([])

    // Grant consent (the same stored preference the Settings screen writes)…
    const consent = await app.inject({
      method: 'PUT',
      url: '/api/preferences',
      headers: { cookie },
      payload: { moodConsent: true },
    })
    expect(consent.statusCode).toBe(200)

    // …then POST persists, and a second POST for the same day overwrites the word.
    const first = await app.inject({
      method: 'POST',
      url: '/api/wellbeing/mood',
      headers: { cookie },
      payload: { mood: 'tense', day: '2026-07-20' },
    })
    expect(first.statusCode).toBe(200)
    expect(first.json()).toEqual({ day: '2026-07-20', mood: 'tense' })
    const second = await app.inject({
      method: 'POST',
      url: '/api/wellbeing/mood',
      headers: { cookie },
      payload: { mood: 'good', day: '2026-07-20' },
    })
    expect(second.statusCode).toBe(200)

    const history = await app.inject({
      method: 'GET',
      url: '/api/wellbeing/mood',
      headers: { cookie },
    })
    expect(history.statusCode).toBe(200)
    expect(history.json()).toEqual([{ day: '2026-07-20', mood: 'good' }])

    // One DELETE wipes the entire history (ADR-0071 P3: erasable in one action).
    const wipe = await app.inject({
      method: 'DELETE',
      url: '/api/wellbeing/mood',
      headers: { cookie },
    })
    expect(wipe.statusCode).toBe(200)
    const after = await app.inject({
      method: 'GET',
      url: '/api/wellbeing/mood',
      headers: { cookie },
    })
    expect(after.json()).toEqual([])
    await app.close()
  })

  it('RecordMood_WithConsent_PersistsAndOverwritesTheSameDay', async () => {
    await setPreferences(db, wsA, idA, { moodConsent: true })
    await svc.recordMood(db, { workspaceId: wsA, userId: idA, day: '2026-07-20', mood: 'tense' })
    // A second punch-out on the same day overwrites the word — never a second row.
    await svc.recordMood(db, {
      workspaceId: wsA,
      userId: idA,
      day: '2026-07-20',
      mood: 'stressed',
    })
    const history = await svc.moodHistory(db, { workspaceId: wsA, userId: idA }, 30)
    expect(history).toEqual([{ day: '2026-07-20', mood: 'stressed' }])
  })

  it('MoodHistory_ReadsNewestFirst', async () => {
    for (const [day, mood] of [
      ['2026-07-18', 'good'],
      ['2026-07-19', 'tense'],
      ['2026-07-20', 'good'],
    ] as const) {
      await svc.recordMood(db, { workspaceId: wsA, userId: idA, day, mood })
    }
    const history = await svc.moodHistory(db, { workspaceId: wsA, userId: idA }, 30)
    expect(history.map(h => h.day)).toEqual(['2026-07-20', '2026-07-19', '2026-07-18'])
  })

  it('DeleteAllMoods_WipesTheEntireHistoryInOneAction', async () => {
    await svc.recordMood(db, { workspaceId: wsA, userId: idA, day: '2026-07-19', mood: 'good' })
    await svc.recordMood(db, { workspaceId: wsA, userId: idA, day: '2026-07-20', mood: 'tense' })
    await svc.deleteAllMoods(db, { workspaceId: wsA, userId: idA })
    expect(await svc.moodHistory(db, { workspaceId: wsA, userId: idA }, 30)).toEqual([])
  })

  it('MoodStore_IsWorkspaceIsolated', async () => {
    // Negative isolation: B's scope never sees A's mood, in either direction.
    await svc.recordMood(db, { workspaceId: wsA, userId: idA, day: '2026-07-20', mood: 'good' })
    expect(await svc.moodHistory(db, { workspaceId: wsB, userId: idB }, 30)).toEqual([])
    // And B's one-action erase cannot touch A's rows.
    await svc.deleteAllMoods(db, { workspaceId: wsB, userId: idB })
    expect(await svc.moodHistory(db, { workspaceId: wsA, userId: idA }, 30)).toHaveLength(1)
  })
})
