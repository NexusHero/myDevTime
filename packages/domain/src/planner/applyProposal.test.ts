import { describe, expect, it } from 'vitest'
import type { PlanBlock } from './plan.js'
import { applyProposal, blockIdOf, MIN_SHRUNK_BLOCK_MIN } from './applyProposal.js'

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
