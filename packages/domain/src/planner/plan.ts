/**
 * The deterministic Co-Planner core (REQ-031, ADR-0011). Produces a proposed day
 * plan — ghost blocks — from fixed anchors (meetings), a prioritized backlog, and
 * break rules: meetings anchor the day, focus blocks fill the free gaps by
 * priority, breaks are inserted after a focus threshold, and unplaceable backlog
 * is reported. Pure and reproducible (ADR-0005): the LLM garnish only
 * ranks/labels/explains *within* these code-enforced blocks and never places time.
 * Minutes are measured from the top of the day (midnight-agnostic — the caller
 * picks the window), matching the design's `plannerBlockRect`.
 */

export type PlanBlockKind = 'meeting' | 'focus' | 'break'

export interface PlanBlock {
  readonly startMin: number
  readonly lenMin: number
  readonly kind: PlanBlockKind
  readonly label: string
  readonly taskId?: string
}

/** A fixed commitment (a meeting) the plan must work around. */
export interface PlanAnchor {
  readonly startMin: number
  readonly lenMin: number
  readonly label: string
}

/** A backlog item competing for focus time; lower `priority` places first. */
export interface PlanCandidate {
  readonly id: string
  readonly label: string
  readonly estimateMin: number
  readonly priority: number
}

export interface PlanInput {
  readonly dayStartMin: number
  readonly dayEndMin: number
  readonly anchors: readonly PlanAnchor[]
  readonly backlog: readonly PlanCandidate[]
  /** Insert a break after this many contiguous focus minutes (default 90). */
  readonly breakAfterMin?: number
  /** Break length in minutes (default 15). */
  readonly breakLenMin?: number
  /** Don't invent a focus sliver shorter than this beyond finishing a task (default 15). */
  readonly minBlockMin?: number
}

export interface DayPlan {
  readonly dayStartMin: number
  readonly dayEndMin: number
  readonly blocks: readonly PlanBlock[]
  readonly plannedFocusMin: number
  /** Backlog estimate that did not fit the day. */
  readonly unplacedMin: number
  /**
   * Anchors the plan could not place — they overlap a kept meeting or fall fully
   * outside the day window. Reported (not silently swallowed) so an overbooked
   * user sees which meetings were dropped rather than being misled (M4).
   */
  readonly droppedAnchors: readonly PlanAnchor[]
}

interface Gap {
  start: number
  end: number
}

/** Clip anchors to the window, drop invalid/overlapping, sort by start. */
function normalizeAnchors(input: PlanInput): { meetings: PlanBlock[]; dropped: PlanAnchor[] } {
  const clipped = input.anchors
    .map(a => {
      const start = Math.max(a.startMin, input.dayStartMin)
      const end = Math.min(a.startMin + a.lenMin, input.dayEndMin)
      return { start, end, original: a }
    })
    .filter(a => a.end > a.start)
    .sort((a, b) => a.start - b.start)

  // Anchors with no positive overlap with the window (clipped away entirely).
  const kept = new Set(clipped.map(a => a.original))
  const dropped: PlanAnchor[] = input.anchors.filter(a => !kept.has(a))

  const meetings: PlanBlock[] = []
  let lastEnd = input.dayStartMin
  for (const a of clipped) {
    if (a.start < lastEnd) {
      dropped.push(a.original) // overlaps a kept anchor → not placed
      continue
    }
    meetings.push({
      startMin: a.start,
      lenMin: a.end - a.start,
      kind: 'meeting',
      label: a.original.label,
    })
    lastEnd = a.end
  }
  return { meetings, dropped }
}

/** The free gaps between/around the meetings, within the day window. */
function freeGaps(meetings: readonly PlanBlock[], input: PlanInput): Gap[] {
  const gaps: Gap[] = []
  let cursor = input.dayStartMin
  for (const m of meetings) {
    if (m.startMin > cursor) gaps.push({ start: cursor, end: m.startMin })
    cursor = m.startMin + m.lenMin
  }
  if (input.dayEndMin > cursor) gaps.push({ start: cursor, end: input.dayEndMin })
  return gaps
}

export function buildDayPlan(input: PlanInput): DayPlan {
  const breakAfterMin = input.breakAfterMin ?? 90
  const breakLenMin = input.breakLenMin ?? 15
  const minBlockMin = input.minBlockMin ?? 15

  const { meetings, dropped } = normalizeAnchors(input)
  const gaps = freeGaps(meetings, input)

  // Remaining minutes per candidate, ordered by priority then estimate then id.
  const queue = [...input.backlog]
    .filter(c => c.estimateMin > 0)
    .sort(
      (a, b) =>
        a.priority - b.priority || b.estimateMin - a.estimateMin || a.id.localeCompare(b.id),
    )
    .map(c => ({ ...c, remaining: c.estimateMin }))

  const focusBreaks: PlanBlock[] = []
  let plannedFocusMin = 0
  let qi = 0

  for (const gap of gaps) {
    let cursor = gap.start
    let sinceBreak = 0
    while (cursor < gap.end && qi < queue.length) {
      const room = gap.end - cursor
      if (room < minBlockMin) break

      // A break is due once a focus run reaches the threshold.
      if (sinceBreak >= breakAfterMin) {
        const bl = Math.min(breakLenMin, room)
        focusBreaks.push({ startMin: cursor, lenMin: bl, kind: 'break', label: 'Break' })
        cursor += bl
        sinceBreak = 0
        continue
      }

      const cand = queue[qi]
      if (!cand) break
      const untilBreak = breakAfterMin - sinceBreak
      const take = Math.min(cand.remaining, room, untilBreak)
      if (take <= 0) {
        qi++
        continue
      }
      focusBreaks.push({
        startMin: cursor,
        lenMin: take,
        kind: 'focus',
        label: cand.label,
        taskId: cand.id,
      })
      plannedFocusMin += take
      cursor += take
      sinceBreak += take
      cand.remaining -= take
      if (cand.remaining <= 0) qi++
    }
  }

  const unplacedMin = queue.slice(qi).reduce((sum, c) => sum + c.remaining, 0)
  const blocks = [...meetings, ...focusBreaks].sort((a, b) => a.startMin - b.startMin)

  return {
    dayStartMin: input.dayStartMin,
    dayEndMin: input.dayEndMin,
    blocks,
    plannedFocusMin,
    unplacedMin,
    droppedAnchors: dropped,
  }
}

export interface PlanReview {
  readonly plannedFocusMin: number
  readonly trackedFocusMin: number
  /** `tracked − planned`; negative means under the plan. */
  readonly driftMin: number
}

/** Plan-vs-actual for the evening review: tracked focus minutes against the plan. */
export function reviewDayPlan(plan: DayPlan, trackedFocusMin: number): PlanReview {
  return {
    plannedFocusMin: plan.plannedFocusMin,
    trackedFocusMin,
    driftMin: trackedFocusMin - plan.plannedFocusMin,
  }
}
