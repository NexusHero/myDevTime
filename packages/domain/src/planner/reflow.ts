/**
 * One-tap day repair — the pure reflow core (ADR-0072 D1, REQ-072; bound by ADR-0005/0071).
 * From the accepted plan of the day, the clock, the caller-judged missed/overrun blocks and
 * the immovable obstacles, `reflowDay` computes a re-layout of the remainder of the day as a
 * **ghost proposal** — it never mutates anything; applying is the plan-apply seam's job, and
 * only after the user's tap.
 *
 * The layout rules, in order of authority:
 * - The **ArbZG hard cap** (`dayEndCapMin`) is inviolable: nothing is ever laid past it, and
 *   a block is never shortened to squeeze it in — work that cannot fit moves **visibly** to
 *   `overflow.moved` (tomorrow/backlog), never silently dropped.
 * - **Fixed obstacles** (meetings from the calendar, 🛡 protected times, absences) and the
 *   plan's own kept blocks — meetings, `locked` blocks, blocks already done or mid-flight —
 *   are never overlapped; re-laid work flows around their remaining-today footprint.
 * - **Nothing moves earlier**: a placement never starts before `nowMin` nor before the
 *   block's own planned start, so an unbroken day reflows to the identical layout (`fits`) —
 *   the repair is idempotent, not an optimizer that re-shuffles a working plan.
 * - **Stable order**: surviving blocks keep their relative order — predictability over
 *   packing cleverness (Motion's silent re-shuffle is exactly what ADR-0072 rejects).
 * - Laying past the personal capacity line (`capacityLineMin`) is allowed but priced:
 *   `overflow.stretch` states `overLineMin` and `projectedEndMin` **before** the tap — the
 *   informed deal ("bewusster Preis + Ruhe"). When both truths apply, `moved` outranks
 *   `stretch`: work leaving the day is the louder fact, and the union reports one kind.
 */

import { freeWindows, type MinuteWindow } from './model.js'
import type { PlanBlockKind } from './plan.js'

/** One plan block as the reflow sees it. `id` is the caller's handle (the seam's block id). */
export interface ReflowBlock {
  readonly id: string
  readonly startMin: number
  readonly lenMin: number
  readonly kind: PlanBlockKind
  /** An explicitly pinned block — the repair never moves it (meetings are implicitly so). */
  readonly locked?: boolean
}

/** An immovable window of the day: a meeting, a 🛡 protected time, an absence. */
export interface FixedObstacle {
  readonly startMin: number
  readonly endMin: number
}

export interface ReflowInput {
  /** Minutes since local midnight — nothing is laid before this instant. */
  readonly nowMin: number
  /** ArbZG-derived hard end of the day (incl. required breaks) — NEVER planned past. */
  readonly dayEndCapMin: number
  /** The personal capacity line (Feierabend target); laying past it is the informed deal. */
  readonly capacityLineMin: number
  /** The accepted plan of the day. */
  readonly blocks: readonly ReflowBlock[]
  /** Meetings, 🛡 protected times, absences — immovable. */
  readonly fixed: readonly FixedObstacle[]
  /** Blocks judged missed/overrun by the caller (the drift detection exists client-side). */
  readonly missedIds: readonly string[]
}

export type ReflowOverflow =
  | { readonly kind: 'fits' }
  | { readonly kind: 'stretch'; readonly overLineMin: number; readonly projectedEndMin: number }
  | { readonly kind: 'moved'; readonly movedBlockIds: readonly string[] }

export interface ReflowProposal {
  readonly placements: readonly {
    readonly id: string
    readonly startMin: number
    readonly lenMin: number
  }[]
  /** `stretch` carries the pre-tap price; `moved` is always visible, never a silent drop. */
  readonly overflow: ReflowOverflow
}

/**
 * Re-lay the remainder of a broken day as a ghost proposal. Pure and deterministic
 * (ADR-0005): same input, same proposal — no clock, no I/O, inputs never mutated.
 */
export function reflowDay(input: ReflowInput): ReflowProposal {
  const missed = new Set(input.missedIds)

  // A block is re-laid when it still belongs to the remainder of the day — judged missed, or
  // not yet started — and nothing pins it. Everything else is KEPT exactly where it is:
  // meetings (immovable by nature), `locked` blocks, and blocks already done or mid-flight
  // (a missed-but-locked block simply stays — locked means locked). Zero-length blocks carry
  // no time and are ignored entirely.
  const movable: ReflowBlock[] = []
  const kept: MinuteWindow[] = []
  for (const b of input.blocks) {
    if (b.lenMin <= 0) continue
    const pinned = b.locked === true || b.kind === 'meeting'
    if (!pinned && (missed.has(b.id) || b.startMin >= input.nowMin)) {
      movable.push(b)
    } else {
      // Only the block's remaining-today footprint blocks time; `freeWindows` clips it.
      kept.push({ startMin: b.startMin, endMin: b.startMin + b.lenMin })
    }
  }

  const windows = freeWindows(input.nowMin, input.dayEndCapMin, [...input.fixed, ...kept])

  const placements: { id: string; startMin: number; lenMin: number }[] = []
  const movedBlockIds: string[] = []
  let cursor = input.nowMin
  for (const b of movable) {
    // Never earlier than the previous placement (stable order) nor the block's own planned
    // start (idempotence: an unbroken block stays put instead of sliding into a morning gap).
    const earliest = Math.max(cursor, b.startMin, input.nowMin)
    const window = windows.find(w => Math.max(w.startMin, earliest) + b.lenMin <= w.endMin)
    if (window === undefined) {
      movedBlockIds.push(b.id) // does not fit under the cap — visible overflow, full length
      continue
    }
    const startMin = Math.max(window.startMin, earliest)
    placements.push({ id: b.id, startMin, lenMin: b.lenMin })
    cursor = startMin + b.lenMin
  }

  if (movedBlockIds.length > 0) {
    return { placements, overflow: { kind: 'moved', movedBlockIds } }
  }
  const lastEnd = placements.reduce((max, p) => Math.max(max, p.startMin + p.lenMin), 0)
  if (placements.length > 0 && lastEnd > input.capacityLineMin) {
    return {
      placements,
      overflow: {
        kind: 'stretch',
        overLineMin: lastEnd - input.capacityLineMin,
        projectedEndMin: lastEnd,
      },
    }
  }
  return { placements, overflow: { kind: 'fits' } }
}
