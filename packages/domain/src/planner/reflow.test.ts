import { describe, expect, it } from 'vitest'
import {
  reflowDay,
  type FixedObstacle,
  type ReflowBlock,
  type ReflowInput,
  type ReflowProposal,
} from './reflow.js'

/**
 * Property tests for the one-tap day repair core (ADR-0072 D1, REQ-072). The five contract
 * invariants are pinned over seeded randomized days (fast-check is not a workspace dependency,
 * so a deterministic PRNG drives hand-rolled property loops — same seed, same days, forever):
 *   1. no placement overlaps a fixed obstacle; none starts before `nowMin`;
 *   2. no placement ends after `dayEndCapMin` — unplaceable work lands in `overflow.moved`,
 *      never silently dropped, never shortened;
 *   3. `stretch` is reported iff everything fit under the cap AND the last placement ends
 *      past `capacityLineMin`, with deterministic price fields;
 *   4. reflowing an unbroken day returns the identical layout with `fits`;
 *   5. the relative order of surviving blocks is preserved.
 * Deterministic table cases pin the cascade, the kept/locked rules and the moved precedence.
 */

// ─── Deterministic PRNG (mulberry32) — the property loops' only randomness ─────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function int(rnd: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rnd() * (hi - lo + 1))
}

function pick<T>(rnd: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rnd() * items.length)]
  if (item === undefined) throw new Error('pick from empty list')
  return item
}

const RUNS = 300

interface RandomDay {
  readonly input: ReflowInput
  readonly proposal: ReflowProposal
}

/** A random (possibly broken) day: mixed past/future blocks, obstacles, missed ids. */
function randomDay(rnd: () => number): RandomDay {
  const nowMin = int(rnd, 300, 900)
  const dayEndCapMin = Math.min(1440, nowMin + int(rnd, 60, 600))
  const capacityLineMin = int(rnd, nowMin - 60, dayEndCapMin + 60)

  const blocks: ReflowBlock[] = []
  let cursor = Math.max(0, nowMin - int(rnd, 0, 240))
  const count = int(rnd, 0, 8)
  for (let i = 0; i < count; i++) {
    const lenMin = int(rnd, 15, 120)
    const startMin = cursor + int(rnd, 0, 45)
    blocks.push({
      id: `b${String(i)}`,
      startMin,
      lenMin,
      kind: pick(rnd, ['focus', 'focus', 'focus', 'break', 'meeting'] as const),
      locked: rnd() < 0.15,
    })
    cursor = startMin + lenMin
  }

  const fixed: FixedObstacle[] = []
  const obstacleCount = int(rnd, 0, 3)
  for (let i = 0; i < obstacleCount; i++) {
    const startMin = int(rnd, nowMin - 60, dayEndCapMin)
    fixed.push({ startMin, endMin: startMin + int(rnd, 15, 90) })
  }

  const missedIds = blocks.filter(() => rnd() < 0.4).map(b => b.id)
  const input: ReflowInput = { nowMin, dayEndCapMin, capacityLineMin, blocks, fixed, missedIds }
  return { input, proposal: reflowDay(input) }
}

/** An UNBROKEN day: nothing missed, every block in the future, laid without conflicts. */
function unbrokenDay(rnd: () => number): RandomDay {
  const nowMin = int(rnd, 300, 700)
  const blocks: ReflowBlock[] = []
  let cursor = nowMin + int(rnd, 0, 30)
  const count = int(rnd, 1, 6)
  for (let i = 0; i < count; i++) {
    const lenMin = int(rnd, 15, 90)
    blocks.push({
      id: `b${String(i)}`,
      startMin: cursor,
      lenMin,
      kind: pick(rnd, ['focus', 'break', 'meeting'] as const),
      locked: rnd() < 0.2,
    })
    cursor += lenMin + int(rnd, 0, 40)
  }
  const lastEnd = cursor
  // Fixed obstacles only OUTSIDE the laid blocks (an unbroken day has no conflicts).
  const fixed: FixedObstacle[] = [{ startMin: lastEnd + 10, endMin: lastEnd + 40 }]
  const input: ReflowInput = {
    nowMin,
    dayEndCapMin: lastEnd + 120,
    capacityLineMin: lastEnd,
    blocks,
    fixed,
    missedIds: [],
  }
  return { input, proposal: reflowDay(input) }
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

describe('reflowDay · invariant 1 — never over a fixed obstacle, never before now', () => {
  it('holds over seeded random days', () => {
    const rnd = mulberry32(0xd1)
    for (let run = 0; run < RUNS; run++) {
      const { input, proposal } = randomDay(rnd)
      for (const p of proposal.placements) {
        expect(p.startMin).toBeGreaterThanOrEqual(input.nowMin)
        for (const o of input.fixed) {
          expect(overlaps(p.startMin, p.startMin + p.lenMin, o.startMin, o.endMin)).toBe(false)
        }
      }
    }
  })

  it('placements never overlap each other or a kept (locked/meeting/running) block', () => {
    const rnd = mulberry32(0xd2)
    for (let run = 0; run < RUNS; run++) {
      const { input, proposal } = randomDay(rnd)
      const placed = [...proposal.placements].sort((a, b) => a.startMin - b.startMin)
      for (let i = 1; i < placed.length; i++) {
        const prev = placed[i - 1]
        const cur = placed[i]
        if (!prev || !cur) throw new Error('unreachable')
        expect(prev.startMin + prev.lenMin).toBeLessThanOrEqual(cur.startMin)
      }
      // Kept blocks (not re-laid, still occupying time ≥ now) are obstacles too.
      const placedIds = new Set(proposal.placements.map(p => p.id))
      const movedIds = new Set(
        proposal.overflow.kind === 'moved' ? proposal.overflow.movedBlockIds : [],
      )
      for (const b of input.blocks) {
        if (placedIds.has(b.id) || movedIds.has(b.id)) continue
        const keptStart = Math.max(b.startMin, input.nowMin)
        const keptEnd = b.startMin + b.lenMin
        if (keptEnd <= keptStart) continue // fully in the past — occupies nothing now
        for (const p of proposal.placements) {
          expect(overlaps(p.startMin, p.startMin + p.lenMin, keptStart, keptEnd)).toBe(false)
        }
      }
    }
  })
})

describe('reflowDay · invariant 2 — the hard cap is inviolable, overflow is honest', () => {
  it('no placement ends after dayEndCapMin; lengths are never shortened', () => {
    const rnd = mulberry32(0xd3)
    for (let run = 0; run < RUNS; run++) {
      const { input, proposal } = randomDay(rnd)
      const byId = new Map(input.blocks.map(b => [b.id, b]))
      for (const p of proposal.placements) {
        expect(p.startMin + p.lenMin).toBeLessThanOrEqual(input.dayEndCapMin)
        expect(p.lenMin).toBe(byId.get(p.id)?.lenMin)
      }
    }
  })

  it('every movable block is either placed or in overflow.moved — never silently dropped', () => {
    const rnd = mulberry32(0xd4)
    for (let run = 0; run < RUNS; run++) {
      const { input, proposal } = randomDay(rnd)
      const missed = new Set(input.missedIds)
      const movable = input.blocks.filter(
        b =>
          b.locked !== true &&
          b.kind !== 'meeting' &&
          (missed.has(b.id) || b.startMin >= input.nowMin),
      )
      const placedIds = new Set(proposal.placements.map(p => p.id))
      const movedIds = proposal.overflow.kind === 'moved' ? proposal.overflow.movedBlockIds : []
      for (const b of movable) {
        expect(placedIds.has(b.id) || movedIds.includes(b.id)).toBe(true)
      }
      // And nothing else ever appears in a placement or the moved list.
      const movableIds = new Set(movable.map(b => b.id))
      for (const id of [...placedIds, ...movedIds]) expect(movableIds.has(id)).toBe(true)
    }
  })
})

describe('reflowDay · invariant 3 — stretch honesty (the informed deal)', () => {
  it('stretch iff everything fit under the cap AND the last placement ends past the line', () => {
    const rnd = mulberry32(0xd5)
    for (let run = 0; run < RUNS; run++) {
      const { input, proposal } = randomDay(rnd)
      const lastEnd = proposal.placements.reduce((m, p) => Math.max(m, p.startMin + p.lenMin), 0)
      if (proposal.overflow.kind === 'moved') {
        expect(proposal.overflow.movedBlockIds.length).toBeGreaterThan(0)
      } else if (lastEnd > input.capacityLineMin) {
        expect(proposal.overflow).toEqual({
          kind: 'stretch',
          overLineMin: lastEnd - input.capacityLineMin,
          projectedEndMin: lastEnd,
        })
      } else {
        expect(proposal.overflow).toEqual({ kind: 'fits' })
      }
    }
  })
})

describe('reflowDay · invariant 4 — idempotence on an unbroken day', () => {
  it('an unbroken day returns the identical layout with fits', () => {
    const rnd = mulberry32(0xd6)
    for (let run = 0; run < RUNS; run++) {
      const { input, proposal } = unbrokenDay(rnd)
      const movable = input.blocks.filter(b => b.locked !== true && b.kind !== 'meeting')
      expect(proposal.placements).toEqual(
        movable.map(b => ({ id: b.id, startMin: b.startMin, lenMin: b.lenMin })),
      )
      expect(proposal.overflow).toEqual({ kind: 'fits' })
    }
  })

  it('re-reflowing an applied proposal is a fixed point', () => {
    const rnd = mulberry32(0xd7)
    for (let run = 0; run < RUNS; run++) {
      const { input, proposal } = randomDay(rnd)
      if (proposal.placements.length === 0) continue
      // Apply: surviving movable blocks take their new places; moved blocks leave the day.
      const placedById = new Map(proposal.placements.map(p => [p.id, p]))
      const movedIds = new Set(
        proposal.overflow.kind === 'moved' ? proposal.overflow.movedBlockIds : [],
      )
      const applied = input.blocks
        .filter(b => !movedIds.has(b.id))
        .map(b => {
          const p = placedById.get(b.id)
          return p ? { ...b, startMin: p.startMin, lenMin: p.lenMin } : b
        })
        .sort((a, b) => a.startMin - b.startMin)
      const second = reflowDay({ ...input, blocks: applied, missedIds: [] })
      expect(second.placements).toEqual(
        [...proposal.placements].sort((a, b) => a.startMin - b.startMin),
      )
    }
  })
})

describe('reflowDay · invariant 5 — stable order of surviving blocks', () => {
  it('placed blocks keep their relative input order', () => {
    const rnd = mulberry32(0xd8)
    for (let run = 0; run < RUNS; run++) {
      const { input, proposal } = randomDay(rnd)
      const inputOrder = input.blocks.map(b => b.id)
      const placedOrder = proposal.placements.map(p => p.id)
      const expected = inputOrder.filter(id => placedOrder.includes(id))
      expect(placedOrder).toEqual(expected)
      // And their start times are monotonic — order is positional, not just nominal.
      for (let i = 1; i < proposal.placements.length; i++) {
        const prev = proposal.placements[i - 1]
        const cur = proposal.placements[i]
        if (!prev || !cur) throw new Error('unreachable')
        expect(cur.startMin).toBeGreaterThanOrEqual(prev.startMin + prev.lenMin)
      }
    }
  })
})

// ─── Deterministic table cases — the contract's worked examples ────────────────────────────

const focus = (id: string, startMin: number, lenMin: number): ReflowBlock => ({
  id,
  startMin,
  lenMin,
  kind: 'focus',
})

describe('reflowDay · worked examples', () => {
  it('re-lays a missed block at now and cascades the rest (the noon fix)', () => {
    // 12:00; A (09:00–10:00) was missed; B 12:30, C 14:00 upcoming. A lands at 12:00,
    // B keeps 12:30… but A ends 13:00 → B pushed to 13:00, C keeps 14:00 (gap big enough).
    const out = reflowDay({
      nowMin: 720,
      dayEndCapMin: 1125,
      capacityLineMin: 1080,
      blocks: [focus('a', 540, 60), focus('b', 750, 60), focus('c', 840, 60)],
      fixed: [],
      missedIds: ['a'],
    })
    expect(out.placements).toEqual([
      { id: 'a', startMin: 720, lenMin: 60 },
      { id: 'b', startMin: 780, lenMin: 60 },
      { id: 'c', startMin: 840, lenMin: 60 },
    ])
    expect(out.overflow).toEqual({ kind: 'fits' })
  })

  it('reports the stretch price when the remainder only fits past the capacity line', () => {
    // 12:00, line at 14:00 (= planned end): missed A appended after B/C ends at 15:00.
    const out = reflowDay({
      nowMin: 720,
      dayEndCapMin: 1125,
      capacityLineMin: 840,
      blocks: [focus('a', 540, 60), focus('b', 720, 60), focus('c', 780, 60)],
      fixed: [],
      missedIds: ['a'],
    })
    expect(out.placements).toEqual([
      { id: 'a', startMin: 720, lenMin: 60 },
      { id: 'b', startMin: 780, lenMin: 60 },
      { id: 'c', startMin: 840, lenMin: 60 },
    ])
    expect(out.overflow).toEqual({ kind: 'stretch', overLineMin: 60, projectedEndMin: 900 })
  })

  it('moves work that cannot fit under the hard cap — visibly, never squeezed', () => {
    const out = reflowDay({
      nowMin: 720,
      dayEndCapMin: 810, // room for one 60-min block only
      capacityLineMin: 780,
      blocks: [focus('a', 540, 60), focus('b', 600, 60)],
      fixed: [],
      missedIds: ['a', 'b'],
    })
    expect(out.placements).toEqual([{ id: 'a', startMin: 720, lenMin: 60 }])
    expect(out.overflow).toEqual({ kind: 'moved', movedBlockIds: ['b'] })
  })

  it("'moved' outranks 'stretch' — cap overflow is the louder truth", () => {
    const out = reflowDay({
      nowMin: 720,
      dayEndCapMin: 840,
      capacityLineMin: 750, // the placed block already ends past the line…
      blocks: [focus('a', 540, 90), focus('b', 600, 60)],
      fixed: [],
      missedIds: ['a', 'b'],
    })
    expect(out.placements).toEqual([{ id: 'a', startMin: 720, lenMin: 90 }])
    expect(out.overflow).toEqual({ kind: 'moved', movedBlockIds: ['b'] }) // …but moved wins
  })

  it('never places over a 🛡 fixed obstacle — the block lands after it', () => {
    const out = reflowDay({
      nowMin: 720,
      dayEndCapMin: 1125,
      capacityLineMin: 1080,
      blocks: [focus('a', 540, 60)],
      fixed: [{ startMin: 700, endMin: 765 }],
      missedIds: ['a'],
    })
    expect(out.placements).toEqual([{ id: 'a', startMin: 765, lenMin: 60 }])
  })

  it('keeps meetings and locked blocks in place and lays around them', () => {
    const out = reflowDay({
      nowMin: 720,
      dayEndCapMin: 1125,
      capacityLineMin: 1080,
      blocks: [
        focus('a', 540, 60),
        { id: 'm', startMin: 720, lenMin: 60, kind: 'meeting' },
        { id: 'l', startMin: 800, lenMin: 30, kind: 'focus', locked: true },
      ],
      fixed: [],
      missedIds: ['a'],
    })
    // The meeting (12:00–13:00) and the locked block (13:20–13:50) are untouched obstacles.
    expect(out.placements).toEqual([{ id: 'a', startMin: 830, lenMin: 60 }])
    expect(out.overflow).toEqual({ kind: 'fits' })
  })

  it('treats an in-progress block (started, not missed) as occupied time', () => {
    const out = reflowDay({
      nowMin: 720,
      dayEndCapMin: 1125,
      capacityLineMin: 1080,
      blocks: [focus('run', 700, 60), focus('a', 540, 30)],
      fixed: [],
      missedIds: ['a'],
    })
    // 'run' is mid-flight (12:00 < 12:40 end): its remainder blocks 12:00–12:40.
    expect(out.placements).toEqual([{ id: 'a', startMin: 760, lenMin: 30 }])
  })

  it('leaves a missed but locked block untouched — locked means locked', () => {
    const out = reflowDay({
      nowMin: 720,
      dayEndCapMin: 1125,
      capacityLineMin: 1080,
      blocks: [{ id: 'a', startMin: 540, lenMin: 60, kind: 'focus', locked: true }],
      fixed: [],
      missedIds: ['a'],
    })
    expect(out.placements).toEqual([])
    expect(out.overflow).toEqual({ kind: 'fits' })
  })

  it('an empty day fits trivially', () => {
    const out = reflowDay({
      nowMin: 720,
      dayEndCapMin: 1125,
      capacityLineMin: 1080,
      blocks: [],
      fixed: [],
      missedIds: [],
    })
    expect(out).toEqual({ placements: [], overflow: { kind: 'fits' } })
  })

  it('ignores a non-positive-length block (it carries no time to re-lay)', () => {
    const out = reflowDay({
      nowMin: 720,
      dayEndCapMin: 1125,
      capacityLineMin: 1080,
      blocks: [{ id: 'z', startMin: 730, lenMin: 0, kind: 'focus' }, focus('a', 750, 30)],
      fixed: [],
      missedIds: [],
    })
    expect(out.placements).toEqual([{ id: 'a', startMin: 750, lenMin: 30 }])
  })

  it('is a pure function — inputs are never mutated', () => {
    const blocks = [focus('a', 540, 60), focus('b', 750, 60)]
    const fixed = [{ startMin: 700, endMin: 730 }]
    const missedIds = ['a']
    const snapshot = JSON.stringify({ blocks, fixed, missedIds })
    reflowDay({
      nowMin: 720,
      dayEndCapMin: 1125,
      capacityLineMin: 1080,
      blocks,
      fixed,
      missedIds,
    })
    expect(JSON.stringify({ blocks, fixed, missedIds })).toBe(snapshot)
  })
})
