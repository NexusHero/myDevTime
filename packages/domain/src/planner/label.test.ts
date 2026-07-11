import { describe, expect, it } from 'vitest'
import { deterministicLabels } from './label.js'
import type { DayPlan, PlanBlock } from './plan.js'

function plan(blocks: PlanBlock[]): DayPlan {
  return {
    dayStartMin: 0,
    dayEndMin: 600,
    blocks,
    plannedFocusMin: 0,
    unplacedMin: 0,
    droppedAnchors: [],
  }
}

describe('deterministicLabels', () => {
  it('EmptyPlan_HasNoLabels', () => {
    expect(deterministicLabels(plan([]))).toEqual([])
  })

  it('RanksOnlyFocusBlocksInPlacementOrder', () => {
    const labels = deterministicLabels(
      plan([
        { startMin: 0, lenMin: 30, kind: 'meeting', label: 'Standup' },
        { startMin: 30, lenMin: 90, kind: 'focus', label: 'Sync engine' },
        { startMin: 120, lenMin: 15, kind: 'break', label: 'Pause' },
        { startMin: 135, lenMin: 60, kind: 'focus', label: 'Reviews' },
      ]),
    )
    expect(labels).toEqual([
      { blockIndex: 0, note: 'Fixer Termin: Standup', rank: 0 },
      { blockIndex: 1, note: 'Fokus 1: Sync engine', rank: 1 },
      { blockIndex: 2, note: 'Pause', rank: 0 },
      { blockIndex: 3, note: 'Fokus 2: Reviews', rank: 2 },
    ])
  })

  it('BlockIndexMatchesPosition', () => {
    const labels = deterministicLabels(
      plan([
        { startMin: 0, lenMin: 60, kind: 'focus', label: 'A' },
        { startMin: 60, lenMin: 60, kind: 'focus', label: 'B' },
      ]),
    )
    expect(labels.map(l => l.blockIndex)).toEqual([0, 1])
    expect(labels.map(l => l.rank)).toEqual([1, 2])
  })
})
