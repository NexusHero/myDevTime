import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { EntityState, SyncValue } from '@mydevtime/domain'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import { pullChanges, pushChanges, type PushChangeInput } from './service.js'

/**
 * The sync engine against a REAL Postgres (SKILL §3.3). Covers REQ-006's
 * acceptance-critical behaviour: workspace-isolated delta sync, idempotent
 * replay, tombstones, running-timer sync, and a surfaced (never silently merged)
 * time-entry conflict. Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('sync engine (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-sync-a'
  const idB = 'itest-sync-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'sync-a@itest.local'],
      [idB, 'sync-b@itest.local'],
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

  const clientState = (id: string, name: string, over: Partial<EntityState> = {}): EntityState => ({
    type: 'client',
    id,
    deletedAt: over.deletedAt ?? null,
    updatedAt: over.updatedAt ?? 1000,
    deviceId: over.deviceId ?? 'devA',
    fields: over.fields ?? { name, archived: false },
  })

  const entryState = (
    id: string,
    fields: Record<string, SyncValue>,
    over: Partial<EntityState> = {},
  ): EntityState => ({
    type: 'timeEntry',
    id,
    deletedAt: over.deletedAt ?? null,
    updatedAt: over.updatedAt ?? 1000,
    deviceId: over.deviceId ?? 'devA',
    fields: {
      userId: idA,
      projectId: null,
      taskId: null,
      billable: true,
      source: 'manual',
      ...fields,
    },
  })

  const push = (ws: string, ...changes: PushChangeInput[]) => pushChanges(db, ws, changes)

  it('Push_NewClient_PullReturnsIt_AndIsWorkspaceIsolated', async () => {
    const id = randomUUID()
    const res = await push(wsA, {
      type: 'client',
      opId: randomUUID(),
      base: null,
      incoming: clientState(id, 'Acme'),
    })
    expect(res.results[0]?.outcome).toBe('applied')
    expect(res.results[0]?.version).toBeGreaterThan(0)

    const a = await pullChanges(db, wsA, 0)
    expect(a.changes.some(c => c.state.id === id)).toBe(true)

    const b = await pullChanges(db, wsB, 0)
    expect(b.changes.some(c => c.state.id === id)).toBe(false)
  })

  it('Push_ReplayedOpId_IsIdempotent', async () => {
    const id = randomUUID()
    const opId = randomUUID()
    const first = await push(wsA, {
      type: 'client',
      opId,
      base: null,
      incoming: clientState(id, 'Once'),
    })
    expect(first.results[0]?.outcome).toBe('applied')
    const replay = await push(wsA, {
      type: 'client',
      opId,
      base: null,
      incoming: clientState(id, 'CHANGED'),
    })
    expect(replay.results[0]?.outcome).toBe('skipped')
    const pulled = await pullChanges(db, wsA, 0)
    expect(pulled.changes.filter(c => c.state.id === id)).toHaveLength(1)
    expect(pulled.changes.find(c => c.state.id === id)?.state.fields.name).toBe('Once')
  })

  it('Push_Delete_IsPulledAsTombstone', async () => {
    const id = randomUUID()
    const base = clientState(id, 'Doomed')
    await push(wsA, { type: 'client', opId: randomUUID(), base: null, incoming: base })
    await push(wsA, {
      type: 'client',
      opId: randomUUID(),
      base,
      incoming: clientState(id, 'Doomed', { deletedAt: 5000, updatedAt: 5000 }),
    })
    const pulled = await pullChanges(db, wsA, 0)
    expect(pulled.changes.find(c => c.state.id === id)?.state.deletedAt).not.toBeNull()
  })

  it('Push_RunningTimer_SyncsWithNullEnd', async () => {
    const id = randomUUID()
    const res = await push(wsA, {
      type: 'timeEntry',
      opId: randomUUID(),
      base: null,
      incoming: entryState(id, { startedAt: 1_000_000, endedAt: null, note: 'live' }),
    })
    expect(res.results[0]?.outcome).toBe('applied')
    const pulled = await pullChanges(db, wsA, 0)
    expect(pulled.changes.find(c => c.state.id === id)?.state.fields.endedAt).toBeNull()
  })

  it('Push_ConflictingInterval_IsSurfacedNotMerged', async () => {
    const id = randomUUID()
    const base = entryState(id, { startedAt: 1_000_000, endedAt: 2_000_000, note: 'x' })
    await push(wsA, { type: 'timeEntry', opId: randomUUID(), base: null, incoming: base })
    // Server moves the end first.
    await push(wsA, {
      type: 'timeEntry',
      opId: randomUUID(),
      base,
      incoming: entryState(
        id,
        { startedAt: 1_000_000, endedAt: 2_500_000, note: 'x' },
        { updatedAt: 2000 },
      ),
    })
    // A stale client pushes a different end from the original base → conflict.
    const res = await push(wsA, {
      type: 'timeEntry',
      opId: randomUUID(),
      base,
      incoming: entryState(
        id,
        { startedAt: 1_000_000, endedAt: 3_000_000, note: 'x' },
        { updatedAt: 3000 },
      ),
    })
    expect(res.results[0]?.outcome).toBe('surfaced')
    // The server interval is kept (2_500_000), not silently overwritten by 3_000_000.
    const pulled = await pullChanges(db, wsA, 0)
    expect(pulled.changes.find(c => c.state.id === id)?.state.fields.endedAt).toBe(2_500_000)
  })

  it('Pull_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/sync/pull' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
