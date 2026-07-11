import type { DayPlan, PlanBlock } from './plan.js'

/**
 * Co-Planner labeling (REQ-031 follow-up, #151, ADR-0011): the LLM *garnish* ranks
 * and labels the day plan's blocks — it never places time (that is the
 * deterministic `buildDayPlan` core's job, ADR-0005). A `PlanLabel` is exactly the
 * shape the LLM fills and the shape the deterministic fallback produces, so the
 * feature degrades gracefully to `deterministicLabels` whenever the provider is
 * down or unfunded. `rank` orders the focus blocks (1 = do first); anchors and
 * breaks carry rank 0.
 */
export interface PlanLabel {
  /** Index into `DayPlan.blocks`. */
  readonly blockIndex: number
  /** A short, human rationale/label for the block. */
  readonly note: string
  /** Do-first order among focus blocks (1..n); 0 for meetings and breaks. */
  readonly rank: number
}

function noteFor(block: PlanBlock, rank: number): string {
  switch (block.kind) {
    case 'meeting':
      return `Fixer Termin: ${block.label}`
    case 'break':
      return 'Pause'
    case 'focus':
      return `Fokus ${String(rank)}: ${block.label}`
  }
}

/**
 * The deterministic label set for a plan: focus blocks ranked in the order the
 * core placed them (which already respects backlog priority), each block noted
 * from its kind and label. Pure and reproducible — the graceful fallback.
 */
export function deterministicLabels(plan: DayPlan): PlanLabel[] {
  let focusRank = 0
  return plan.blocks.map((block, blockIndex) => {
    const rank = block.kind === 'focus' ? ++focusRank : 0
    return { blockIndex, note: noteFor(block, rank), rank }
  })
}
