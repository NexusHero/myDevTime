import { describe, expect, it } from 'vitest'
import { applyPush, emptyServer, pull, type EntityState, type SyncServer } from '@mydevtime/domain'
import { openTestDb } from './testing/node-sqlite.js'
import { listProjects } from './catalog.js'
import { getRunningEntry, listEntries } from './entries.js'
import { enqueueOp } from './outbox.js'
import { runSync, type SyncTransport } from './sync.js'

const WS = 'local'
const T0 = Date.parse('2026-01-01T09:00:00.000Z')
const HOUR = 3_600_000

/**
 * A fake server that IS the tested domain engine — `runSync` drives the real
 * `applyPush`/`pull` over an in-memory `SyncServer`, so this is a genuine
 * convergence test from the client change-log, not a mock.
 */
function engineTransport(): { transport: SyncTransport; server: () => SyncServer } {
  let server = emptyServer()
  return {
    server: () => server,
    transport: {
      async push(changes) {
        await Promise.resolve()
        const res = applyPush(
          server,
          changes.map(c => ({ opId: c.opId, base: c.base, incoming: c.incoming })),
        )
        server = res.server
        return res.results.map(r => ({
          opId: r.opId,
          outcome: r.outcome,
          version: r.version,
          state: r.state,
          ...(r.conflict ? { conflict: r.conflict } : {}),
        }))
      },
      async pull(since) {
        await Promise.resolve()
        const r = pull(server, since)
        return {
          changes: r.changes.map(c => ({ version: c.version, state: c.state })),
          watermark: r.watermark,
        }
      },
    },
  }
}

function projectState(id: string, name: string, deviceId: string, updatedAt = T0): EntityState {
  return {
    type: 'project',
    id,
    deletedAt: null,
    updatedAt,
    deviceId,
    fields: { name, clientId: null, color: null, billableDefault: true, archived: false },
  }
}

function entryState(
  id: string,
  startedAt: number,
  deviceId: string,
  updatedAt: number,
): EntityState {
  return {
    type: 'timeEntry',
    id,
    deletedAt: null,
    updatedAt,
    deviceId,
    fields: {
      projectId: null,
      taskId: null,
      startedAt,
      endedAt: null,
      billable: true,
      source: 'timer',
      note: null,
    },
  }
}

describe('runSync (client orchestrator over the domain engine)', () => {
  it('PushesAnOfflineInsert_ThenReflectsItLocally', async () => {
    const db = await openTestDb()
    const { transport, server } = engineTransport()
    await enqueueOp(db, WS, {
      entityType: 'project',
      entityId: 'p1',
      incoming: projectState('p1', 'Offline project', 'devA'),
    })

    const outcome = await runSync(db, WS, transport)

    expect(outcome.pushed).toBe(1)
    expect(outcome.surfaced).toHaveLength(0)
    expect(server().records.size).toBe(1) // server now holds the project
    expect(outcome.watermark).toBe(1)
    // The push cleared the outbox; the pull wrote the server-authoritative row back.
    const projects = await listProjects(db, WS)
    expect(projects.map(p => p.name)).toEqual(['Offline project'])
  })

  it('ConvergesASecondDevice_ViaPull', async () => {
    const dbA = await openTestDb()
    const dbB = await openTestDb()
    const { transport } = engineTransport()

    await enqueueOp(dbA, WS, {
      entityType: 'project',
      entityId: 'p1',
      incoming: projectState('p1', 'Shared', 'devA'),
    })
    await runSync(dbA, WS, transport) // A pushes + pulls its own insert

    const b = await runSync(dbB, WS, transport) // B has nothing to push; pulls A's insert
    expect(b.pushed).toBe(0)
    expect(b.pulled).toBe(1)
    expect((await listProjects(dbB, WS)).map(p => p.name)).toEqual(['Shared'])
  })

  it('IsIdempotent_ASecondRunPushesNothingNew', async () => {
    const db = await openTestDb()
    const { transport } = engineTransport()
    await enqueueOp(db, WS, {
      entityType: 'timeEntry',
      entityId: 'e1',
      incoming: entryState('e1', T0, 'devA', T0),
    })
    await runSync(db, WS, transport)
    const second = await runSync(db, WS, transport)
    expect(second.pushed).toBe(0) // outbox already cleared
    // The running entry restored from the server-authoritative row.
    expect(await getRunningEntry(db, WS)).not.toBeNull()
    expect(await listEntries(db, WS)).toHaveLength(1)
  })

  it('SurfacesAnIntervalConflict_AcrossTwoDevices', async () => {
    const dbA = await openTestDb()
    const dbB = await openTestDb()
    const { transport } = engineTransport()

    // Both devices know entry e1 at version 1 (A inserts, B pulls).
    await enqueueOp(dbA, WS, {
      entityType: 'timeEntry',
      entityId: 'e1',
      incoming: entryState('e1', T0, 'devA', T0),
    })
    await runSync(dbA, WS, transport)
    await runSync(dbB, WS, transport)

    const base = entryState('e1', T0, 'devA', T0) // the shared v1 snapshot

    // A moves the start earlier and syncs (server → v2).
    await enqueueOp(dbA, WS, {
      entityType: 'timeEntry',
      entityId: 'e1',
      baseVersion: 1,
      base,
      incoming: entryState('e1', T0 - HOUR, 'devA', T0 + HOUR),
    })
    await runSync(dbA, WS, transport)

    // B, still based on v1, moves the start later — the interval conflict must surface.
    await enqueueOp(dbB, WS, {
      entityType: 'timeEntry',
      entityId: 'e1',
      baseVersion: 1,
      base,
      incoming: entryState('e1', T0 + HOUR, 'devB', T0 + HOUR),
    })
    const b = await runSync(dbB, WS, transport)

    expect(b.surfaced).toHaveLength(1)
    expect(b.surfaced[0]?.conflict?.fields).toContain('startedAt')
  })
})
