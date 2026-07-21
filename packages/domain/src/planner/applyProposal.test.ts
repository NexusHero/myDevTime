import { describe, expect, it } from 'vitest'
import type { PlanBlock } from './plan.js'
import {
  addBlocks,
  applyProposal,
  blockIdOf,
  MIN_SHRUNK_BLOCK_MIN,
  relayoutDay,
} from './applyProposal.js'

/**
 * Acceptance for the plan-apply block mutation (ADR-0071 P4, REQ-070). A confirmed Sevi
 * proposal may move a block (duration preserved) or shrink it (never below the 15-minute
 * floor); the input array is never mutated, the result keeps the start-order invariant, and
 * an unknown block id is an honest `null` — never a silent no-op the caller mistakes for a
 * write.
 */
const blocks: readonly PlanBlock[] = [
  { startMin: 540, lenMin: 30, kind: 'meeting', label: 'Daily' },
  { startMin: 570, lenMin: 90, kind: 'focus', label: 'Sync engine', taskId: 't1' },
  { startMin: 660, lenMin: 15, kind: 'break', label: 'Break' },
]

describe('applyProposal — move-block', () => {
  it('MovesTheBlockKeepingItsDuration_AndResorts', () => {
    const out = applyProposal(blocks, {
      kind: 'move-block',
      blockId: blockIdOf(1),
      toStartMin: 480,
    })
    expect(out).not.toBeNull()
    // Moved before the meeting → re-sorted to the front, duration untouched.
    expect(out![0]).toEqual({
      startMin: 480,
      lenMin: 90,
      kind: 'focus',
      label: 'Sync engine',
      taskId: 't1',
    })
    expect(out!.map(b => b.startMin)).toEqual([480, 540, 660])
  })

  it('LeavesTheInputArrayUntouched', () => {
    const before = blocks.map(b => ({ ...b }))
    applyProposal(blocks, { kind: 'move-block', blockId: blockIdOf(1), toStartMin: 480 })
    expect(blocks).toEqual(before)
  })

  it('UnknownBlockId_ReturnsNull', () => {
    expect(applyProposal(blocks, { kind: 'move-block', blockId: '9', toStartMin: 480 })).toBeNull()
    expect(
      applyProposal(blocks, { kind: 'move-block', blockId: 'nope', toStartMin: 480 }),
    ).toBeNull()
  })
})

describe('applyProposal — shrink-block', () => {
  it('ShrinksTheBlockByTheRequestedMinutes', () => {
    const out = applyProposal(blocks, { kind: 'shrink-block', blockId: blockIdOf(1), byMin: 30 })
    expect(out![1]).toMatchObject({ startMin: 570, lenMin: 60 })
  })

  it('ClampsSoAtLeastFifteenMinutesRemain', () => {
    // 90 − 80 = 10 < the floor → the block keeps exactly MIN_SHRUNK_BLOCK_MIN.
    const out = applyProposal(blocks, { kind: 'shrink-block', blockId: blockIdOf(1), byMin: 80 })
    expect(out![1]).toMatchObject({ lenMin: MIN_SHRUNK_BLOCK_MIN })
  })

  it('BlockAlreadyAtTheFloor_ShrinksNoFurther', () => {
    const out = applyProposal(blocks, { kind: 'shrink-block', blockId: blockIdOf(2), byMin: 10 })
    expect(out![2]).toMatchObject({ lenMin: 15 })
  })

  it('UnknownBlockId_ReturnsNull', () => {
    expect(applyProposal(blocks, { kind: 'shrink-block', blockId: '-1', byMin: 10 })).toBeNull()
  })
})

describe('relayoutDay — the one-tap repair (ADR-0072 D1)', () => {
  it('ReLaysSeveralBlocksAtOnce_UntouchedBlocksKeepTheirPlace_AndResorts', () => {
    const out = relayoutDay(blocks, [
      { blockId: blockIdOf(1), startMin: 720, lenMin: 60 }, // focus: moved + shrunk
      { blockId: blockIdOf(2), startMin: 690, lenMin: 15 }, // break: moved before it
    ])
    expect(out).not.toBeNull()
    expect(out!).toEqual([
      { startMin: 540, lenMin: 30, kind: 'meeting', label: 'Daily' },
      { startMin: 690, lenMin: 15, kind: 'break', label: 'Break' },
      { startMin: 720, lenMin: 60, kind: 'focus', label: 'Sync engine', taskId: 't1' },
    ])
  })

  it('EmptyPlacements_ReturnsTheSameBlocksAsANewArray', () => {
    const out = relayoutDay(blocks, [])
    expect(out).toEqual([...blocks])
    expect(out).not.toBe(blocks)
  })

  it('UnknownBlockId_ReturnsNull_AndLeavesTheInputUntouched', () => {
    const before = blocks.map(b => ({ ...b }))
    expect(
      relayoutDay(blocks, [
        { blockId: blockIdOf(1), startMin: 720, lenMin: 60 },
        { blockId: '9', startMin: 800, lenMin: 30 },
      ]),
    ).toBeNull()
    expect(blocks).toEqual(before)
  })

  it('PlacementBelowTheFifteenMinuteFloor_ReturnsNull', () => {
    expect(
      relayoutDay(blocks, [
        { blockId: blockIdOf(1), startMin: 720, lenMin: MIN_SHRUNK_BLOCK_MIN - 1 },
      ]),
    ).toBeNull()
  })

  it('DuplicateBlockIdInThePlacements_ReturnsNull', () => {
    // Two placements for one block are an ambiguous repair — refuse, never "last wins".
    expect(
      relayoutDay(blocks, [
        { blockId: blockIdOf(1), startMin: 720, lenMin: 60 },
        { blockId: blockIdOf(1), startMin: 900, lenMin: 30 },
      ]),
    ).toBeNull()
  })

  it('LeavesTheInputArrayUntouchedOnSuccess', () => {
    const before = blocks.map(b => ({ ...b }))
    relayoutDay(blocks, [{ blockId: blockIdOf(0), startMin: 600, lenMin: 30 }])
    expect(blocks).toEqual(before)
  })
})

describe('addBlocks — fill-week / first-run additions (ADR-0072 D2/D3)', () => {
  it('AppendsTheAdditions_AndResortsByStart', () => {
    const out = addBlocks(blocks, [
      { startMin: 480, lenMin: 45, kind: 'focus', label: 'Inbox zero' },
      { startMin: 690, lenMin: 60, kind: 'focus', label: 'Review PRs', taskId: 't2' },
    ])
    expect(out).not.toBeNull()
    expect(out!.map(b => b.startMin)).toEqual([480, 540, 570, 660, 690])
    expect(out![0]).toEqual({ startMin: 480, lenMin: 45, kind: 'focus', label: 'Inbox zero' })
    expect(out![4]).toEqual({
      startMin: 690,
      lenMin: 60,
      kind: 'focus',
      label: 'Review PRs',
      taskId: 't2',
    })
  })

  it('WorksOnAnEmptyDay_TheFirstRunPath', () => {
    const out = addBlocks([], [{ startMin: 540, lenMin: 90, kind: 'focus', label: 'Kickoff' }])
    expect(out).toEqual([{ startMin: 540, lenMin: 90, kind: 'focus', label: 'Kickoff' }])
  })

  it('EmptyAdditions_ReturnsTheSameBlocksAsANewArray', () => {
    const out = addBlocks(blocks, [])
    expect(out).toEqual([...blocks])
    expect(out).not.toBe(blocks)
  })

  it('AdditionBelowTheFifteenMinuteFloor_ReturnsNull', () => {
    expect(
      addBlocks(blocks, [
        { startMin: 480, lenMin: 45, kind: 'focus', label: 'ok' },
        { startMin: 700, lenMin: MIN_SHRUNK_BLOCK_MIN - 1, kind: 'focus', label: 'too short' },
      ]),
    ).toBeNull()
  })

  it('LeavesTheInputArrayUntouched', () => {
    const before = blocks.map(b => ({ ...b }))
    addBlocks(blocks, [{ startMin: 480, lenMin: 45, kind: 'focus', label: 'Inbox zero' }])
    expect(blocks).toEqual(before)
  })
})
