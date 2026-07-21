/**
 * Shared minute-window math for the planner's daily loop (ADR-0072). Both the one-tap day
 * repair (`planner/reflow`) and the fill-week packing (`planner/packing`) answer the same
 * question first — *where is there still room?* — so the gap computation lives here once,
 * pure and exhaustive (ADR-0005). Minutes are from the top of the day, matching
 * `PlanBlock`'s convention; windows are half-open `[startMin, endMin)`.
 */

export interface MinuteWindow {
  readonly startMin: number
  readonly endMin: number
}

/**
 * The free sub-windows of `[rangeStartMin, rangeEndMin)` after removing the obstacles.
 * Obstacles may arrive unsorted and overlapping (meetings, 🛡 windows, kept blocks from any
 * source) — they are clipped to the range and merged; inverted/zero-length obstacles carry no
 * time and are ignored; zero-length free slivers are never emitted. Pure.
 */
export function freeWindows(
  rangeStartMin: number,
  rangeEndMin: number,
  obstacles: readonly MinuteWindow[],
): MinuteWindow[] {
  const clipped = obstacles
    .map(o => ({
      startMin: Math.max(o.startMin, rangeStartMin),
      endMin: Math.min(o.endMin, rangeEndMin),
    }))
    .filter(o => o.endMin > o.startMin)
    .sort((a, b) => a.startMin - b.startMin)

  const free: MinuteWindow[] = []
  let cursor = rangeStartMin
  for (const o of clipped) {
    if (o.startMin > cursor) free.push({ startMin: cursor, endMin: o.startMin })
    // Overlapping/contained obstacles merge here: the cursor only ever advances.
    cursor = Math.max(cursor, o.endMin)
  }
  if (rangeEndMin > cursor) free.push({ startMin: cursor, endMin: rangeEndMin })
  return free
}
