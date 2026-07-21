import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { session, user } from '../../db/auth-schema.js'
import { clients, projects, protectedTimes, wellbeingMoods, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import * as tracking from '../tracking/service.js'
import * as svc from './service.js'

/**
 * GDPR privacy against a REAL Postgres (REQ-020). Covers the acceptance-critical invariants:
 * the export is complete for the caller's workspace and **never** leaks another workspace's
 * rows (negative isolation, ADR-0015), erasure removes the workspace row (cascading all tenant
 * data) plus the Better-Auth identity rows, the retention purge hard-deletes only tombstones
 * older than the cutoff, and the guard rejects unauthenticated callers. Skips without
 * DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('privacy (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-privacy-a'
  const idB = 'itest-privacy-b'
  const idC = 'itest-privacy-c'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'privacy-a@itest.local'],
      [idB, 'privacy-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    // The erasure test deletes these itself; clean up defensively if it failed.
    await db.delete(user).where(eq(user.id, idC))
    await handle.close()
  })

  it('Export_OwnWorkspace_ContainsOwnButNeverOtherWorkspacesData', async () => {
    await tracking.createProject(db, wsA, { name: 'A-Export-Proj' })
    await tracking.createProject(db, wsB, { name: 'B-Secret-Proj' })
    // The branch's most sensitive datum (consented moods) and the 🛡 windows are personal
    // data too — data portability (Art. 20) must carry them like every other store.
    await db
      .insert(wellbeingMoods)
      .values({ workspaceId: wsA, userId: idA, day: '2026-07-20', mood: 'tense' })
    await db
      .insert(wellbeingMoods)
      .values({ workspaceId: wsB, userId: idB, day: '2026-07-20', mood: 'good' })
    await db
      .insert(protectedTimes)
      .values({ workspaceId: wsA, userId: idA, day: '2026-07-21', startMin: 1080, endMin: 1320 })

    const exported = await svc.exportWorkspaceData(db, wsA, idA)

    expect(exported.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(exported.user).toMatchObject({ id: idA, email: 'privacy-a@itest.local' })
    expect(exported.workspace.id).toBe(wsA)
    expect(exported.data.projects.some(p => p.name === 'A-Export-Proj')).toBe(true)
    // The caller's own mood rows travel (day + word only) — and never workspace B's.
    expect(exported.data.wellbeingMoods).toEqual([{ day: '2026-07-20', mood: 'tense' }])
    expect(
      exported.data.protectedTimes.some(p => p.day === '2026-07-21' && p.startMin === 1080),
    ).toBe(true)
    // Negative isolation: nothing of workspace B may appear anywhere in A's export.
    expect(exported.data.projects.some(p => p.name === 'B-Secret-Proj')).toBe(false)
    for (const rows of Object.values(exported.data)) {
      for (const row of rows as { workspaceId?: string }[]) {
        if (row.workspaceId !== undefined) expect(row.workspaceId).toBe(wsA)
      }
    }
  })

  it('Purge_MixedTombstones_DeletesOnlyExpiredSoftDeletedRows', async () => {
    const oldClient = await tracking.createClient(db, wsA, { name: 'A-Old-Tombstone' })
    const freshClient = await tracking.createClient(db, wsA, { name: 'A-Fresh-Tombstone' })
    const liveClient = await tracking.createClient(db, wsA, { name: 'A-Live' })
    await tracking.deleteClient(db, wsA, oldClient.id)
    await tracking.deleteClient(db, wsA, freshClient.id)
    // Backdate one tombstone past the 90-day window; the other stays fresh.
    await db
      .update(clients)
      .set({ deletedAt: new Date(Date.now() - 100 * 86_400_000) })
      .where(eq(clients.id, oldClient.id))
    // A workspace-B tombstone of the same age must survive A's purge (isolation).
    const otherClient = await tracking.createClient(db, wsB, { name: 'B-Old-Tombstone' })
    await tracking.deleteClient(db, wsB, otherClient.id)
    await db
      .update(clients)
      .set({ deletedAt: new Date(Date.now() - 100 * 86_400_000) })
      .where(eq(clients.id, otherClient.id))

    const purged = await svc.purgeSoftDeleted(db, wsA, 90)

    expect(purged.clients).toBe(1)
    const remaining = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.workspaceId, wsA)))
    const remainingIds = remaining.map(r => r.id)
    expect(remainingIds).not.toContain(oldClient.id)
    expect(remainingIds).toContain(freshClient.id)
    expect(remainingIds).toContain(liveClient.id)
    const bRows = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, otherClient.id))
    expect(bRows).toHaveLength(1)
  })

  it('EraseAccount_Confirmed_RemovesWorkspaceIdentityAndAllTenantRows', async () => {
    await db.delete(user).where(eq(user.id, idC))
    await db.insert(user).values({
      id: idC,
      name: idC,
      email: 'privacy-c@itest.local',
      emailVerified: true,
    })
    const wsC = await resolveWorkspaceId(db, idC, 'C')
    await tracking.createProject(db, wsC, { name: 'C-Doomed-Proj' })
    await db.insert(session).values({
      id: 'itest-privacy-c-session',
      userId: idC,
      token: 'itest-privacy-c-token',
      expiresAt: new Date(Date.now() + 3_600_000),
    })

    await svc.eraseAccount(db, wsC, idC)

    expect(await db.select().from(workspaces).where(eq(workspaces.id, wsC))).toHaveLength(0)
    expect(await db.select().from(user).where(eq(user.id, idC))).toHaveLength(0)
    expect(await db.select().from(session).where(eq(session.userId, idC))).toHaveLength(0)
    expect(await db.select().from(projects).where(eq(projects.workspaceId, wsC))).toHaveLength(0)
  })

  it('GetExport_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/privacy/export' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
