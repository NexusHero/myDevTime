import { priceWeek, weekLoadFromMinutes, type WeekPrice } from '@mydevtime/domain'

/**
 * Client glue for the Planner in-canvas Price-of-week panel (REQ-050, design v13 G1).
 * Sums the week's *planned* work from the canvas blocks (everything but breaks) and runs
 * the deterministic `priceWeek` solver across the three intensities. Pure — the solver
 * owns every figure (ADR-0005); this only shapes the input. A standard 8h × 5-day frame
 * is the what-if baseline the panel states explicitly.
 */
export interface PlannedBlock {
  readonly kind: string
  readonly len: number
}

/** Total planned work minutes in the week: every block except breaks, clamped ≥ 0. */
export function plannedWorkMinutes(blocks: readonly PlannedBlock[]): number {
  return blocks.filter(b => b.kind !== 'break').reduce((sum, b) => sum + Math.max(0, b.len), 0)
}

/** Price the planned week across sustainable/balanced/dense, or `[]` when nothing is
 *  planned. Revenue is left at zero (the canvas carries no rate); the panel reads the
 *  days / per-day load / overtime / strain, which is what the intensity trade-off is about. */
export function priceWeekFromBlocks(
  blocks: readonly PlannedBlock[],
  opts: { availableDays?: number; targetDailyMin?: number } = {},
): WeekPrice[] {
  const totalWorkMin = plannedWorkMinutes(blocks)
  if (totalWorkMin <= 0) return []
  return priceWeek(
    weekLoadFromMinutes({
      totalWorkMin,
      availableDays: opts.availableDays ?? 5,
      targetDailyMin: opts.targetDailyMin ?? 480,
      billableWorkMin: totalWorkMin,
      ratePerHourMinor: 0,
    }),
  )
}
