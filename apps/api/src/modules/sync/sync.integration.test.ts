import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { exportJWK, generateKeyPair } from 'jose'
import { and, eq } from 'drizzle-orm'
import type { EntityState, SyncValue } from '@mydevtime/domain'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { syncConflicts, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import {
  pullChanges,
  pushChanges,
  uploadCrud,
  type CrudWriteInput,
  type PushChangeInput,
} from './service.js'

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

  // ── PowerSync CRUD upload path (ADR-0043) ──────────────────────────────────
  const upload = (ws: string, ...writes: CrudWriteInput[]) => uploadCrud(db, ws, writes)
  const entryData = (over: Record<string, SyncValue> = {}): Record<string, SyncValue> => ({
    userId: idA,
    projectId: null,
    taskId: null,
    startedAt: 1_000_000,
    endedAt: 2_000_000,
    billable: true,
    source: 'manual',
    note: 'x',
    ...over,
  })

  it('Upload_Put_InsertsAndIsPulled', async () => {
    const id = randomUUID()
    const res = await upload(wsA, {
      type: 'client',
      op: 'put',
      id,
      data: { name: 'Acme', archived: false },
      baseVersion: null,
      updatedAt: 1000,
      deviceId: 'devA',
    })
    expect(res.results[0]?.outcome).toBe('applied')
    expect(res.results[0]?.version).toBeGreaterThan(0)
    const pulled = await pullChanges(db, wsA, 0)
    expect(pulled.changes.find(c => c.state.id === id)?.state.fields.name).toBe('Acme')
  })

  it('Upload_Patch_MergesChangedFieldOntoCurrent', async () => {
    const id = randomUUID()
    const put = await upload(wsA, {
      type: 'timeEntry',
      op: 'put',
      id,
      data: entryData(),
      baseVersion: null,
      updatedAt: 1000,
      deviceId: 'devA',
    })
    const v1 = put.results[0]?.version ?? 0
    const patched = await upload(wsA, {
      type: 'timeEntry',
      op: 'patch',
      id,
      data: { note: 'updated' },
      baseVersion: v1, // no concurrent change → applies
      updatedAt: 2000,
      deviceId: 'devA',
    })
    expect(patched.results[0]?.outcome).toBe('applied')
    const st = (await pullChanges(db, wsA, 0)).changes.find(c => c.state.id === id)?.state
    expect(st?.fields.note).toBe('updated')
    expect(st?.fields.endedAt).toBe(2_000_000) // the note patch left the interval intact
  })

  it('Upload_ConflictingInterval_IsSurfaced_ServerRowKept_ConflictRecorded', async () => {
    const id = randomUUID()
    const put = await upload(wsA, {
      type: 'timeEntry',
      op: 'put',
      id,
      data: entryData(),
      baseVersion: null,
      updatedAt: 1000,
      deviceId: 'devA',
    })
    const v1 = put.results[0]?.version ?? 0
    // The server moves the end first (from v1).
    await upload(wsA, {
      type: 'timeEntry',
      op: 'patch',
      id,
      data: { endedAt: 2_500_000 },
      baseVersion: v1,
      updatedAt: 2000,
      deviceId: 'devA',
    })
    // A stale client, still based on v1, moves the end differently → surfaced.
    const res = await upload(wsA, {
      type: 'timeEntry',
      op: 'patch',
      id,
      data: { endedAt: 3_000_000 },
      baseVersion: v1,
      updatedAt: 3000,
      deviceId: 'devB',
    })
    expect(res.results[0]?.outcome).toBe('surfaced')
    expect(res.results[0]?.fields).toContain('endedAt')
    const st = (await pullChanges(db, wsA, 0)).changes.find(c => c.state.id === id)?.state
    expect(st?.fields.endedAt).toBe(2_500_000) // server interval kept, not overwritten by 3_000_000
    const conflicts = await db
      .select()
      .from(syncConflicts)
      .where(and(eq(syncConflicts.workspaceId, wsA), eq(syncConflicts.entityId, id)))
    expect(conflicts.length).toBeGreaterThan(0)
  })

  it('Upload_Delete_Tombstones_ThenIsIdempotentNoop', async () => {
    const id = randomUUID()
    const put = await upload(wsA, {
      type: 'client',
      op: 'put',
      id,
      data: { name: 'Doomed', archived: false },
      baseVersion: null,
      updatedAt: 1000,
      deviceId: 'devA',
    })
    const v1 = put.results[0]?.version ?? 0
    const del = await upload(wsA, {
      type: 'client',
      op: 'delete',
      id,
      data: {},
      baseVersion: v1,
      updatedAt: 5000,
      deviceId: 'devA',
    })
    expect(del.results[0]?.outcome).toBe('applied')
    const again = await upload(wsA, {
      type: 'client',
      op: 'delete',
      id,
      data: {},
      baseVersion: v1,
      updatedAt: 6000,
      deviceId: 'devA',
    })
    expect(again.results[0]?.outcome).toBe('noop')
    const st = (await pullChanges(db, wsA, 0)).changes.find(c => c.state.id === id)?.state
    expect(st?.deletedAt).not.toBeNull()
  })

  it('Upload_IsWorkspaceIsolated', async () => {
    const id = randomUUID()
    await upload(wsA, {
      type: 'client',
      op: 'put',
      id,
      data: { name: 'Secret', archived: false },
      baseVersion: null,
      updatedAt: 1000,
      deviceId: 'devA',
    })
    const b = await pullChanges(db, wsB, 0)
    expect(b.changes.some(c => c.state.id === id)).toBe(false)
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

  // ── PowerSync auth (ADR-0043) ──────────────────────────────────────────────
  async function privateJwkJson(): Promise<string> {
    const { privateKey } = await generateKeyPair('RS256', { extractable: true })
    return JSON.stringify({ ...(await exportJWK(privateKey)), alg: 'RS256' })
  }

  it('PowerSyncKeys_ArePublished_WhenConfigured', async () => {
    const app = await buildApp({
      config: loadConfig({
        LOG_LEVEL: 'silent',
        AUTH_SECRET: 'x'.repeat(32),
        POWERSYNC_JWT_PRIVATE_JWK: await privateJwkJson(),
      }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/sync/keys' })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ keys: { kid?: string; d?: string; use?: string }[] }>()
    expect(body.keys).toHaveLength(1)
    expect(body.keys[0]?.kid).toBeTruthy()
    expect(body.keys[0]?.use).toBe('sig')
    expect(body.keys[0]?.d).toBeUndefined() // public key only — no private member
    await app.close()
  })

  it('PowerSyncKeys_Return404_WhenUnconfigured', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/sync/keys' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('PowerSyncToken_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({
        LOG_LEVEL: 'silent',
        AUTH_SECRET: 'x'.repeat(32),
        POWERSYNC_JWT_PRIVATE_JWK: await privateJwkJson(),
      }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/sync/token' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
