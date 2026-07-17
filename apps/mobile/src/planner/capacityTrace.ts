import { clamp, MINUTE_MS, weekCapacity, type WeekCapacity } from '@mydevtime/domain'

/**
 * Client glue for the Planner capacity head-trace (REQ-055, design v14 §F Stufe 2). It runs
 * the deterministic `weekCapacity` core over the canvas' real blocks so the header can show
 * the **true plannable capacity** — the contracted target minus the person's own life /
 * protected (🛡) commitments ("KW32 nur 24h"). Pure: the domain owns every figure (ADR-0005);
 * this only shapes the canvas blocks into the core's input. Blocks that are neither `life` nor
 * protected are work and never reduce capacity; with no life blocks the week is honestly the
 * full target, and the trace lights up the moment life/protected blocks flow.
 */

/** The canvas' day frame starts at 08:00, so a block's `start` is offset into minute-of-day. */
const DAY_START_MIN = 8 * 60

/** The minimum shape the trace needs from a canvas block. */
export interface CapacityBlock {
  /** Day index within the week (0-based). */
  readonly day: number
  /** Start, minutes from 08:00. */
  readonly start: number
  /** Length in minutes. */
  readonly len: number
  readonly kind: string
  /** The 🛡 protection flag (D14) — a protected life block still consumes plannable capacity. */
  readonly protectedFlag?: boolean
}

export interface CapacityTraceOptions {
  /** Working days in the week (default 5). */
  readonly availableDays?: number
  /** Contracted daily target, minutes (default 480 = 8h). */
  readonly targetDailyMin?: number
}

/** Whether a block consumes plannable capacity: a `life` entry or any protected block. */
function isCommitment(block: CapacityBlock): boolean {
  return block.kind === 'life' || block.protectedFlag === true
}

/**
 * The week's true plannable capacity from the canvas blocks. Each working day carries the
 * contracted target and its own life/protected commitments (clamped into the day and mapped
 * to minute-of-day); `weekCapacity` merges overlaps and clamps plannable at zero.
 */
export function weekCapacityFromBlocks(
  blocks: readonly CapacityBlock[],
  opts: CapacityTraceOptions = {},
): WeekCapacity {
  const availableDays = Math.max(0, opts.availableDays ?? 5)
  const dayTargetMs = Math.max(0, opts.targetDailyMin ?? 480) * MINUTE_MS

  const days = Array.from({ length: availableDays }, (_, d) => {
    const commitments = blocks
      .filter(b => b.day === d && isCommitment(b))
      .map(b => ({
        kind: b.protectedFlag === true ? ('protected' as const) : ('life' as const),
        startMin: clamp(DAY_START_MIN + b.start, 0, 1440),
        endMin: clamp(DAY_START_MIN + b.start + b.len, 0, 1440),
      }))
      .filter(c => c.endMin > c.startMin)
    return { targetMs: dayTargetMs, commitments }
  })

  return weekCapacity(days)
}
