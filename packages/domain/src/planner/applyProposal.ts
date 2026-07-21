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

import type { PlanBlock } from './plan.js'

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
