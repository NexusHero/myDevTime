import { describe, expect, it } from 'vitest'
import {
  applyPush,
  emptyServer,
  entityKey,
  pull,
  type PushChange,
  type PushResult,
  type SyncServer,
} from './engine.js'
import type { EntityState, SyncValue } from './types.js'

/**
 * Convergence simulation (REQ-006 test approach): two simulated devices + a
 * server, scripted interleavings (offline-edit-both-sides, delete-vs-edit,
 * timer stop races) plus a seeded randomized run. Asserts every device
 * converges to the same authoritative state and that a time entry's minutes are
 * never lost or silently blended — a surfaced interval conflict keeps one side
 * and preserves the other for review.
 */

// ── Device model ─────────────────────────────────────────────────────────────

interface Device {
  readonly id: string
  readonly local: Map<string, EntityState>
  readonly base: Map<string, EntityState>
  watermark: number
  surfaced: PushResult[]
}

function device(id: string): Device {
  return { id, local: new Map(), base: new Map(), watermark: 0, surfaced: [] }
}

function contentEqual(a: EntityState, b: EntityState): boolean {
  if (a.deletedAt !== b.deletedAt) return false
  const names = new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])
  for (const name of names) {
    const av: SyncValue = a.fields[name] ?? null
    const bv: SyncValue = b.fields[name] ?? null
    if (av !== bv) return false
  }
  return true
}

/** Apply a local edit on a device: stamps device id + a monotonic clock. */
function edit(dev: Device, e: Omit<EntityState, 'deviceId' | 'updatedAt'>, clock: number): void {
  dev.local.set(entityKey(e.type, e.id), { ...e, deviceId: dev.id, updatedAt: clock })
}

function pendingChanges(dev: Device): PushChange[] {
  const out: PushChange[] = []
  for (const [key, state] of dev.local) {
    const base = dev.base.get(key)
    if (!base || !contentEqual(base, state)) {
      out.push({
        opId: `${dev.id}:${key}:${String(state.updatedAt)}`,
        base: base ?? null,
        incoming: state,
      })
    }
  }
  return out
}

/** One full sync cycle: push local changes, then pull and adopt authoritative state. */
function sync(dev: Device, server: SyncServer): SyncServer {
  const push = applyPush(server, pendingChanges(dev))
  dev.surfaced.push(...push.results.filter(r => r.outcome === 'surfaced'))
  const pulled = pull(push.server, dev.watermark)
  for (const record of pulled.changes) {
    const key = entityKey(record.state.type, record.state.id)
    dev.local.set(key, record.state)
    dev.base.set(key, record.state)
  }
  dev.watermark = pulled.watermark
  return push.server
}

/** Sync every device twice so edits propagate A→server→B and back. */
function settle(devices: Device[], server: SyncServer): SyncServer {
  for (let round = 0; round < 2; round++) {
    for (const dev of devices) server = sync(dev, server)
  }
  return server
}

function assertConverged(devices: Device[], server: SyncServer): void {
  for (const dev of devices) {
    expect(dev.local.size).toBe(server.records.size)
    for (const [key, record] of server.records) {
      const local = dev.local.get(key)
      expect(local).toBeDefined()
      if (local) expect(contentEqual(local, record.state)).toBe(true)
    }
  }
}

const te = (
  id: string,
  fields: Record<string, SyncValue>,
  deletedAt: number | null = null,
): Omit<EntityState, 'deviceId' | 'updatedAt'> => ({ type: 'timeEntry', id, deletedAt, fields })

// ── Scripted scenarios ───────────────────────────────────────────────────────

describe('sync convergence (two devices + server)', () => {
  it('Convergence_OfflineNoteEditBothSides_LastWriterWins', () => {
    let server = emptyServer()
    const a = device('devA')
    const b = device('devB')

    edit(a, te('e1', { note: 'orig', startedAt: 100, endedAt: 200 }), 1)
    server = settle([a, b], server) // both now hold e1

    edit(a, te('e1', { note: 'from-A', startedAt: 100, endedAt: 200 }), 5)
    edit(b, te('e1', { note: 'from-B', startedAt: 100, endedAt: 200 }), 9) // later writer
    server = settle([a, b], server)

    assertConverged([a, b], server)
    expect(a.local.get(entityKey('timeEntry', 'e1'))?.fields.note).toBe('from-B')
    expect(a.surfaced).toHaveLength(0)
    expect(b.surfaced).toHaveLength(0)
  })

  it('Convergence_IntervalEditBothSides_SurfacesAndKeepsMinutes', () => {
    let server = emptyServer()
    const a = device('devA')
    const b = device('devB')

    edit(a, te('e1', { note: 'x', startedAt: 100, endedAt: 200 }), 1)
    server = settle([a, b], server)

    // Both change the END offline to different values → interval conflict.
    edit(a, te('e1', { note: 'x', startedAt: 100, endedAt: 260 }), 5)
    edit(b, te('e1', { note: 'x', startedAt: 100, endedAt: 290 }), 9)
    server = settle([a, b], server)

    assertConverged([a, b], server)
    const converged = server.records.get(entityKey('timeEntry', 'e1'))?.state.fields.endedAt
    // Deterministic single winner — never a blend/average of 260 and 290.
    expect([260, 290]).toContain(converged)
    // The conflict was surfaced (minutes preserved for review, not dropped).
    const surfaced = [...a.surfaced, ...b.surfaced]
    expect(surfaced.length).toBeGreaterThan(0)
    expect(surfaced.some(s => s.conflict?.fields.includes('endedAt'))).toBe(true)
  })

  it('Convergence_DeleteVsEditOnTimeEntry_Surfaces', () => {
    let server = emptyServer()
    const a = device('devA')
    const b = device('devB')

    edit(a, te('e1', { note: 'x', startedAt: 100, endedAt: 200 }), 1)
    server = settle([a, b], server)

    edit(a, te('e1', { note: 'x', startedAt: 100, endedAt: 200 }, 7), 7) // A deletes
    edit(b, te('e1', { note: 'edited', startedAt: 100, endedAt: 200 }), 9) // B edits
    server = settle([a, b], server)

    assertConverged([a, b], server)
    expect([...a.surfaced, ...b.surfaced].length).toBeGreaterThan(0)
  })

  it('Convergence_TimerStopRace_DeterministicSingleEnd', () => {
    let server = emptyServer()
    const a = device('devA')
    const b = device('devB')

    // A starts a timer (running: endedAt null); both devices see it.
    edit(a, te('e1', { note: 'work', startedAt: 100, endedAt: null }), 1)
    server = settle([a, b], server)
    expect(a.local.get(entityKey('timeEntry', 'e1'))?.fields.endedAt).toBeNull()

    // Both stop it offline at different instants.
    edit(a, te('e1', { note: 'work', startedAt: 100, endedAt: 300 }), 5)
    edit(b, te('e1', { note: 'work', startedAt: 100, endedAt: 305 }), 9)
    server = settle([a, b], server)

    assertConverged([a, b], server)
    const end = server.records.get(entityKey('timeEntry', 'e1'))?.state.fields.endedAt
    expect([300, 305]).toContain(end) // one authoritative end, never both
  })
})

// ── Seeded randomized convergence ────────────────────────────────────────────

/** Deterministic PRNG (mulberry32) — no Math.random, so the run is reproducible. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('sync convergence (seeded randomized)', () => {
  for (const seed of [1, 7, 42, 1337, 90210]) {
    it(`Convergence_RandomInterleavings_AllDevicesAgree_seed${String(seed)}`, () => {
      const rng = mulberry32(seed)
      const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)] as T
      let clock = 0
      let server = emptyServer()
      const devices = [device('devA'), device('devB'), device('devC')]
      const ids = ['e1', 'e2', 'e3']

      for (let step = 0; step < 200; step++) {
        const dev = pick(devices)
        const id = pick(ids)
        const key = entityKey('timeEntry', id)
        const op = pick(['note', 'interval', 'delete', 'sync', 'sync'] as const)
        clock += 1

        const tag = `n${String(clock)}`
        if (op === 'sync') {
          server = sync(dev, server)
        } else if (op === 'delete') {
          edit(dev, te(id, { note: tag, startedAt: 100, endedAt: 200 }, clock), clock)
        } else if (op === 'note') {
          const cur = dev.local.get(key)
          const startedRaw = cur?.fields.startedAt
          const endedRaw = cur?.fields.endedAt
          const started = typeof startedRaw === 'number' ? startedRaw : 100
          const ended = typeof endedRaw === 'number' ? endedRaw : 200
          edit(dev, te(id, { note: tag, startedAt: started, endedAt: ended }), clock)
        } else {
          edit(dev, te(id, { note: tag, startedAt: 100, endedAt: 200 + clock }), clock)
        }
      }

      server = settle(devices, server)
      server = settle(devices, server) // extra pass to flush any late tombstones
      assertConverged(devices, server)
    })
  }
})
