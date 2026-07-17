import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { partnerShares, timeEntries, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import * as svc from './service.js'

/**
 * Partner-light sharing against a REAL Postgres (SKILL §3.3): a one-link Free/Busy grant, the
 * **negative isolation** that no title/project/note ever crosses the boundary, workspace scope,
 * revocation, and the guard split (public read, authenticated management). The projection math is
 * unit-tested pure; here we prove the persistence + the leak-proofing. Skips without DATABASE_URL.
 */
const databaseUrl = process.env.DATABASE_URL
const H = 3_600_000

describe.skipIf(!databaseUrl)('sharing (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-share-a'
  const idB = 'itest-share-b'
  let wsA = ''
  let wsB = ''

  const T0 = Date.parse('2026-07-06T00:00:00Z')
  const SECRET = 'Salary review with Anna'

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'share-a@itest.local'],
      [idB, 'share-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    await db.delete(timeEntries).where(inArray(timeEntries.workspaceId, [wsA, wsB]))
    await db.delete(partnerShares).where(inArray(partnerShares.workspaceId, [wsA, wsB]))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  /** Insert a completed entry carrying a private note/title we must never expose. */
  async function seedBusy(ws: string, uid: string, startMs: number, endMs: number): Promise<void> {
    await db.insert(timeEntries).values({
      workspaceId: ws,
      userId: uid,
      startedAt: new Date(startMs),
      endedAt: new Date(endMs),
      source: 'manual',
      note: SECRET,
    })
  }

  it('FreeBusyForShare_ExposesBusyIntervalsButNeverTheDetail', async () => {
    await seedBusy(wsA, idA, T0 + 9 * H, T0 + 11 * H)
    const share = await svc.createShare(db, wsA, idA, 'Anna')

    const result = await svc.freeBusyForShare(db, share.token, T0 + 8 * H, T0 + 17 * H)

    expect(result.busy).toEqual([{ startMs: T0 + 9 * H, endMs: T0 + 11 * H, state: 'busy' }])
    // The negative isolation test: the private note must not survive anywhere in the response.
    expect(JSON.stringify(result)).not.toContain('Salary')
    for (const slot of result.busy) {
      expect(Object.keys(slot).sort()).toEqual(['endMs', 'startMs', 'state'])
    }
  })

  it('PublicEndpoint_ServesFreeBusyWithoutAuthAndLeaksNothing', async () => {
    await seedBusy(wsA, idA, T0 + 9 * H, T0 + 10 * H)
    const share = await svc.createShare(db, wsA, idA, null)

    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({
      method: 'GET',
      url: `/api/sharing/${share.token}/freebusy?from=${String(T0 + 8 * H)}&to=${String(T0 + 17 * H)}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain('Salary')
    const body = res.json<{ busy: unknown[]; free: unknown[] }>()
    expect(body.busy).toHaveLength(1)
    expect(body.free.length).toBeGreaterThan(0)
    await app.close()
  })

  it('FreeBusy_IsScopedToTheShareWorkspace', async () => {
    // A busy entry in B must never appear through A's link.
    await seedBusy(wsB, idB, T0 + 9 * H, T0 + 11 * H)
    const shareA = await svc.createShare(db, wsA, idA, null)
    const result = await svc.freeBusyForShare(db, shareA.token, T0 + 8 * H, T0 + 17 * H)
    expect(result.busy).toEqual([])
  })

  it('RevokedShare_ResolvesToNothingAndIsA404', async () => {
    const share = await svc.createShare(db, wsA, idA, null)
    await svc.revokeShare(db, wsA, share.id, T0)
    expect(await svc.resolveShare(db, share.token)).toBeNull()
    await expect(svc.freeBusyForShare(db, share.token, T0, T0 + H)).rejects.toThrow(
      'share not found',
    )
  })

  it('UnknownToken_IsA404', async () => {
    await expect(
      svc.freeBusyForShare(db, 'does-not-exist-token-xxxxxxxx', T0, T0 + H),
    ).rejects.toThrow('share not found')
  })

  it('RevokeIsWorkspaceScoped_BCannotRevokeAsShare', async () => {
    const share = await svc.createShare(db, wsA, idA, null)
    // B tries to revoke A's share id → not found in B's workspace, link stays live.
    await expect(svc.revokeShare(db, wsB, share.id, T0)).rejects.toThrow('share not found')
    expect(await svc.resolveShare(db, share.token)).not.toBeNull()
  })

  it('CreateShare_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({ method: 'POST', url: '/api/sharing', payload: { label: 'x' } })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
