/**
 * Planner layer filter (design v17 §F6.5) — the "Work / Life / Both" pills in the Planner
 * header. One person, one timeline: work and life share the calendar, and this filter only
 * changes what's *shown*, never what exists. Default is **Both**; a solo user who never adds a
 * `life` entry sees the same calendar with or without it. Pure — a `kind` and a layer decide
 * visibility, nothing else.
 */
export type PlannerLayer = 'work' | 'life' | 'both'

export const PLANNER_LAYERS: readonly PlannerLayer[] = ['both', 'work', 'life']

/** Whether an entry of `kind` is shown under `layer`. `life` is the only non-work kind. */
export function inLayer(kind: string, layer: PlannerLayer): boolean {
  if (layer === 'both') return true
  const isLife = kind === 'life'
  return layer === 'life' ? isLife : !isLife
}
