import { MINUTE_MS, type DurationMs } from '../tracking/time.js'
import { MIN_SHRUNK_BLOCK_MIN, blockIdOf } from '../planner/applyProposal.js'
import type { WeekCapacity } from './plannable.js'

/**
 * The Scrum-Master advisory core (REQ-070, ADR-0071): does the planned load of a week fit the
 * *honest* plannable capacity — the REQ-055 `weekCapacity` result (target minus life/protected),
 * reused as-is and never re-derived here? Pure and deterministic (ADR-0005): Sevi's banner may
 * phrase the finding warmly, but every figure — the signed overage, the severity level, which
 * blocks could give relief — comes from this function alone, and nothing here mutates anything:
 * relief candidates are *proposals* the caller must route through the one confirmed plan-apply
 * seam.
 *
 * Accounting rules (each one keeps the numbers honest):
 * - Planned load = `meeting` + `focus` blocks. Breaks are rest, not load. `life` blocks are
 *   **relief-only**: their capacity cost already lives inside `week` (built from the same
 *   source), so counting them as load too would double-book the person against themselves.
 * - Overages are **signed** (`planned − plannable`) — headroom reads negative, never a clamped
 *   zero, so a caller can show "24 h free" as honestly as "+7 h over".
 * - Relief never touches a `meeting` (other people's time), a 🛡-protected block (the user
 *   shielded it deliberately), or a break. A focus block can shrink down to the planner's
 *   15-min floor; a life block can move wholly out of the work window.
 */

/** Severity of a load vs. its honest capacity. `tight` = over by at most the tolerance. */
export type CommitmentLevel = 'within' | 'tight' | 'over'

/**
 * The minimum shape the advisory needs from a planned block. Structurally a superset of the
 * planner's `PlanBlock`, widened with the Planner canvas' extras: `life` blocks (relief-only),
 * an optional `day` index into `week.days` (blocks without one count at week level only), and
 * the 🛡 `protectedFlag` (design v14 D14) that removes a block from relief entirely.
 */
export interface AdvisoryBlock {
  readonly kind: 'meeting' | 'focus' | 'break' | 'life'
  /** Start, minute-of-day — carried for the caller's slot mapping, not used in the sums. */
  readonly startMin: number
  readonly lenMin: number
  /** Index into `week.days`; omitted (or out of range) → the block counts at week level only. */
  readonly day?: number
  /** The 🛡 shield (design v14 D14): a protected block is never offered as relief. */
  readonly protectedFlag?: boolean
}

/** One block the user could confirm to relieve the overcommit, addressed by array position. */
export interface ReliefCandidate {
  /** `blockIdOf(index)` into the passed block array — the plan-apply seam's addressing. */
  readonly blockId: string
  readonly kind: 'focus' | 'life'
  /** How much load this block could honestly give back (shrink room / full move), ms. */
  readonly movableMs: DurationMs
}

export interface CommitmentAdvisory {
  readonly dayLevel: CommitmentLevel
  readonly weekLevel: CommitmentLevel
  /** Signed worst per-day `planned − plannable` (ms); negative = every day has headroom. */
  readonly dayOverageMs: DurationMs
  /** Signed week `planned − plannable` (ms); negative = the week has headroom. */
  readonly weekOverageMs: DurationMs
  /** Largest-movable first; empty whenever nothing is overbooked — a buddy never nags. */
  readonly relief: readonly ReliefCandidate[]
}

/** Being over by up to 30 min reads `tight`, not `over` — a nudge, not an alarm. */
export const DEFAULT_OVERCOMMIT_TOLERANCE_MS: DurationMs = 30 * MINUTE_MS

/** True when the block adds to the planned work load (meetings anchor, focus fills). */
function isLoad(block: AdvisoryBlock): boolean {
  return block.kind === 'meeting' || block.kind === 'focus'
}

function levelOf(overageMs: number, toleranceMs: number): CommitmentLevel {
  if (overageMs > toleranceMs) return 'over'
  if (overageMs > 0) return 'tight'
  return 'within'
}

/** What a block could give back: shrink room for focus, the whole length for life. */
function movableMsOf(block: AdvisoryBlock): number {
  if (block.protectedFlag === true) return 0
  if (block.kind === 'focus') return Math.max(0, block.lenMin - MIN_SHRUNK_BLOCK_MIN) * MINUTE_MS
  if (block.kind === 'life') return block.lenMin * MINUTE_MS
  return 0 // meetings are other people's time; breaks are rest — never relief
}

/**
 * Measure a week's planned blocks against its honest capacity and name the relief options.
 * Empty input (no blocks, or an absent/zero-capacity week) always reads `within` with empty
 * relief — silence is the correct advisory for a plan that fits.
 */
export function commitmentAdvisory(
  week: WeekCapacity,
  blocks: readonly AdvisoryBlock[],
  toleranceMs: DurationMs = DEFAULT_OVERCOMMIT_TOLERANCE_MS,
): CommitmentAdvisory {
  const valid = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.lenMin > 0)

  const weekPlannedMs = valid
    .filter(({ block }) => isLoad(block))
    .reduce((sum, { block }) => sum + block.lenMin * MINUTE_MS, 0)
  const weekOverageMs = weekPlannedMs - week.plannableMs

  // Worst single day: per-day planned (only blocks that name a valid day) vs. that day's own
  // plannable. A week can be fine in total while one day is quietly overbooked — and vice versa.
  let dayOverageMs = 0
  for (const [d, day] of week.days.entries()) {
    const plannedMs = valid
      .filter(({ block }) => isLoad(block) && block.day === d)
      .reduce((sum, { block }) => sum + block.lenMin * MINUTE_MS, 0)
    const overage = plannedMs - day.plannableMs
    if (d === 0 || overage > dayOverageMs) dayOverageMs = overage
  }

  const weekLevel = levelOf(weekOverageMs, toleranceMs)
  const dayLevel = levelOf(dayOverageMs, toleranceMs)

  // Relief only exists when something is actually overbooked — a fitting plan gets silence.
  const relief: ReliefCandidate[] =
    weekLevel === 'within' && dayLevel === 'within'
      ? []
      : valid
          .map(({ block, index }) => ({
            blockId: blockIdOf(index),
            kind: block.kind,
            movableMs: movableMsOf(block),
          }))
          .filter(
            (r): r is ReliefCandidate =>
              (r.kind === 'focus' || r.kind === 'life') && r.movableMs > 0,
          )
          .sort((a, b) => b.movableMs - a.movableMs || Number(a.blockId) - Number(b.blockId))

  return { dayLevel, weekLevel, dayOverageMs, weekOverageMs, relief }
}
