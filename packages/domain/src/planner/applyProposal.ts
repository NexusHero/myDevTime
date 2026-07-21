/**
 * Plan-apply block mutation (ADR-0071 P4, REQ-070) — the pure half of the plan-apply seam. A
 * Sevi suggestion ("start later", "make this block lighter") becomes a plan mutation **only**
 * after the user confirmed it; this module then applies exactly that confirmed change to the
 * stored blocks, deterministically (ADR-0005 — the LLM proposes, code mutates). The caller
 * (the planner service) persists the result as a **new plan version**, so the proposal history
 * stays intact, mirroring `generatePlan`'s versioning.
 *
 * Blocks carry no ids of their own, so a mutation addresses a block by its **position in the
 * stored array** (stringified index — stable per plan version, and a new version is written on
 * every apply). A move keeps the block's duration; a shrink never leaves less than the
 * planner's 15-minute minimum block. An unknown/invalid id yields `null` — an honest failure
 * the caller maps to a client error, never a silent no-op mistaken for a write. Deliberately
 * *no* overlap resolution here: the user confirmed this exact placement, and the versioned
 * plan records what they chose (the planner's conflict banner surfaces any overlap).
 */

import type { PlanBlock, PlanBlockKind } from './plan.js'

/** A confirmed block mutation. `blockId` addresses the block by stored-array position. */
export type PlanBlockMutation =
  | { readonly kind: 'move-block'; readonly blockId: string; readonly toStartMin: number }
  | { readonly kind: 'shrink-block'; readonly blockId: string; readonly byMin: number }

/** A shrink never leaves a block shorter than this (the planner's `minBlockMin` default). */
export const MIN_SHRUNK_BLOCK_MIN = 15

/** The canonical block id for a block at `index` of the stored array. */
export function blockIdOf(index: number): string {
  return String(index)
}

/** Resolve a block id back to a valid array index, or null when it addresses nothing. */
function indexOf(blocks: readonly PlanBlock[], blockId: string): number | null {
  const index = Number(blockId)
  if (!Number.isInteger(index) || index < 0 || index >= blocks.length) return null
  return index
}

/**
 * Apply one confirmed mutation to a plan's blocks, returning the new block array (re-sorted to
 * keep the start-order invariant) — or `null` when `blockId` addresses no block. Pure: the
 * input array is never touched.
 */
export function applyProposal(
  blocks: readonly PlanBlock[],
  proposal: PlanBlockMutation,
): PlanBlock[] | null {
  const index = indexOf(blocks, proposal.blockId)
  if (index === null) return null
  const target = blocks[index]
  if (!target) return null

  const mutated: PlanBlock =
    proposal.kind === 'move-block'
      ? { ...target, startMin: proposal.toStartMin }
      : {
          ...target,
          // A negative "shrink" must never grow the block; the floor always holds.
          lenMin: Math.max(MIN_SHRUNK_BLOCK_MIN, target.lenMin - Math.max(0, proposal.byMin)),
        }

  const next = blocks.map((b, i) => (i === index ? mutated : b))
  return next.sort((a, b) => a.startMin - b.startMin)
}

// ─── Batch mutations for the daily loop (ADR-0072) ─────────────────────────────────────────

/** One block's confirmed new place in a day-repair re-layout. */
export interface RelayoutPlacement {
  readonly blockId: string
  readonly startMin: number
  readonly lenMin: number
}

/**
 * Re-lay several blocks of one plan at once — the one-tap repair (ADR-0072 D1). Untouched
 * blocks keep their place; the result is re-sorted to keep the start-order invariant. `null`
 * when any `blockId` addresses no block, any `lenMin` is below the 15-minute floor, or a
 * block id appears twice (two placements for one block are an ambiguous repair — refused
 * outright, never resolved "last one wins"). Pure: the input array is never touched.
 */
export function relayoutDay(
  blocks: readonly PlanBlock[],
  placements: readonly RelayoutPlacement[],
): PlanBlock[] | null {
  const byIndex = new Map<number, RelayoutPlacement>()
  for (const p of placements) {
    const index = indexOf(blocks, p.blockId)
    if (index === null) return null
    if (byIndex.has(index)) return null
    if (p.lenMin < MIN_SHRUNK_BLOCK_MIN) return null
    byIndex.set(index, p)
  }
  const next = blocks.map((b, i) => {
    const p = byIndex.get(i)
    return p ? { ...b, startMin: p.startMin, lenMin: p.lenMin } : b
  })
  return next.sort((a, b) => a.startMin - b.startMin)
}

/** One new block to append — the fill-week / first-run path (ADR-0072 D2/D3). */
export interface BlockAddition {
  readonly startMin: number
  readonly lenMin: number
  readonly kind: PlanBlockKind
  readonly label: string
  readonly taskId?: string
}

/**
 * Append new blocks to a plan — the fill-week confirm and Sevi's first-run ghost week land
 * through this. `null` when any `lenMin` is below the 15-minute floor; the result is
 * re-sorted. Deliberately no overlap resolution (the user confirmed these exact placements —
 * same contract as `applyProposal`). Pure; an empty existing day is a valid starting point.
 */
export function addBlocks(
  blocks: readonly PlanBlock[],
  additions: readonly BlockAddition[],
): PlanBlock[] | null {
  if (additions.some(a => a.lenMin < MIN_SHRUNK_BLOCK_MIN)) return null
  const added: PlanBlock[] = additions.map(a => ({
    startMin: a.startMin,
    lenMin: a.lenMin,
    kind: a.kind,
    label: a.label,
    ...(a.taskId === undefined ? {} : { taskId: a.taskId }),
  }))
  return [...blocks, ...added].sort((a, b) => a.startMin - b.startMin)
}
