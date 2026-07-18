import type { Occurrence, SeriesKind } from '../api/recurrence.js'

/**
 * Map recurring-series occurrences (design v17 §F4) onto the Planner week canvas. The server
 * projects the occurrences from the stored rule (deterministic, ADR-0005); this pure function
 * only places each on its day column and converts its minute-of-day to the canvas' offset from
 * `START_HOUR`. An occurrence outside the shown week is dropped; one starting before the canvas
 * day clamps to the top. Recurring blocks always carry `rec: true` (the ↻ badge).
 */

/** The canvas kinds the Planner renders. A recurring `focus` series is a fixed planned block. */
export type RecurringBlockKind = 'meeting' | 'actual' | 'break' | 'life' | 'travel'

export interface RecurringBlock {
  /** Day index within the shown week (0-based). */
  readonly day: number
  /** Start, minutes from `START_HOUR`. */
  readonly start: number
  /** Length in minutes. */
  readonly len: number
  readonly label: string
  readonly kind: RecurringBlockKind
  readonly project?: string
  /** Always true — a recurring occurrence shows the ↻ badge. */
  readonly rec: true
  /** The series this occurrence came from (for edit / split). */
  readonly seriesId: string
}

const KIND_MAP: Record<SeriesKind, RecurringBlockKind> = {
  meeting: 'meeting',
  focus: 'actual',
  break: 'break',
  life: 'life',
  travel: 'travel',
}

/**
 * Place each occurrence on the week. `weekDates` is the seven `YYYY-MM-DD` day columns in order;
 * `startHour` is the canvas' first hour (08:00 → 8). Occurrences off the week are dropped.
 */
export function occurrencesToBlocks(
  occurrences: readonly Occurrence[],
  weekDates: readonly string[],
  startHour = 8,
): RecurringBlock[] {
  const offset = startHour * 60
  const out: RecurringBlock[] = []
  for (const occ of occurrences) {
    const day = weekDates.indexOf(occ.date)
    if (day === -1) continue
    out.push({
      day,
      start: Math.max(0, occ.startMin - offset),
      len: occ.lenMin,
      label: occ.title,
      kind: KIND_MAP[occ.kind],
      ...(occ.projectId !== null ? { project: occ.projectId } : {}),
      rec: true,
      seriesId: occ.seriesId,
    })
  }
  return out
}
