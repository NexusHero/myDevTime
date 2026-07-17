import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from './workspace.js'
import * as svc from './service.js'

/**
 * Catalog against a REAL Postgres (SKILL §3.3). The acceptance-critical part of
 * REQ-001: **negative isolation tests for every entity** — a caller resolved to
 * workspace A can never read or write workspace B's rows — plus the archiving
 * invariants. Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('tracking catalog (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-user-a'
  const idB = 'itest-user-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'a@itest.local'],
      [idB, 'b@itest.local'],
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
    await handle.close()
  })

  it('ResolveWorkspaceId_SameUserTwice_IsIdempotent', async () => {
    expect(await resolveWorkspaceId(db, idA, 'A')).toBe(wsA)
    expect(wsA).not.toBe(wsB)
  })

  it('Client_CrossWorkspaceAccess_IsDenied', async () => {
    const a = await svc.createClient(db, wsA, { name: 'A-Client' })
    await svc.createClient(db, wsB, { name: 'B-Client' })

    const listA = await svc.listClients(db, wsA)
    expect(listA.some(c => c.name === 'A-Client')).toBe(true)
    expect(listA.some(c => c.name === 'B-Client')).toBe(false)

    await expect(svc.getClient(db, wsB, a.id)).rejects.toThrow(/not found/)
    await expect(svc.deleteClient(db, wsB, a.id)).rejects.toThrow(/not found/)
    expect(await svc.getClient(db, wsA, a.id)).toMatchObject({ name: 'A-Client' })
  })

  it('Project_CrossWorkspaceAccess_IsDenied', async () => {
    const p = await svc.createProject(db, wsA, { name: 'A-Proj' })
    await expect(svc.getProject(db, wsB, p.id)).rejects.toThrow(/not found/)
    await expect(svc.updateProject(db, wsB, p.id, { name: 'hijack' })).rejects.toThrow(/not found/)
  })

  it('Task_CrossWorkspaceAccess_IsDenied', async () => {
    const p = await svc.createProject(db, wsA, { name: 'Proj-for-task' })
    const t = await svc.createTask(db, wsA, { name: 'A-Task', projectId: p.id })
    await expect(svc.getTask(db, wsB, t.id)).rejects.toThrow(/not found/)
  })

  it('Tag_CrossWorkspaceAccess_IsDenied', async () => {
    const tag = await svc.createTag(db, wsA, { name: 'A-Tag' })
    const listB = await svc.listTags(db, wsB)
    expect(listB.some(x => x.id === tag.id)).toBe(false)
  })

  it('CreateProject_ArchivedClient_IsRejected', async () => {
    const client = await svc.createClient(db, wsA, { name: 'Archived-Client' })
    await svc.updateClient(db, wsA, client.id, { archived: true })
    await expect(svc.createProject(db, wsA, { name: 'x', clientId: client.id })).rejects.toThrow(
      /archived/,
    )
  })

  it('CreateTask_ArchivedProject_IsRejected', async () => {
    const p = await svc.createProject(db, wsA, { name: 'ToArchive' })
    await svc.updateProject(db, wsA, p.id, { archived: true })
    await expect(svc.createTask(db, wsA, { name: 'x', projectId: p.id })).rejects.toThrow(
      /archived/,
    )
  })

  it('ListProjects_ArchivedHiddenByDefault_VisibleWithFlag', async () => {
    const p = await svc.createProject(db, wsA, { name: 'Hidden' })
    await svc.updateProject(db, wsA, p.id, { archived: true })
    expect((await svc.listProjects(db, wsA)).some(x => x.id === p.id)).toBe(false)
    expect((await svc.listProjects(db, wsA, true)).some(x => x.id === p.id)).toBe(true)
  })

  it('Project_FixedFeeMinor_RoundTripsAndClears', async () => {
    // Design v17 §K4: the expected (fixed-fee) revenue persists, and a later null clears it.
    const p = await svc.createProject(db, wsA, { name: 'FixedFee', fixedFeeMinor: 500000 })
    expect(p.fixedFeeMinor).toBe(500000)
    const updated = await svc.updateProject(db, wsA, p.id, { fixedFeeMinor: 750000 })
    expect(updated.fixedFeeMinor).toBe(750000)
    const cleared = await svc.updateProject(db, wsA, p.id, { fixedFeeMinor: null })
    expect(cleared.fixedFeeMinor).toBeNull()
  })

  it('GetClients_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/tracking/clients' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
