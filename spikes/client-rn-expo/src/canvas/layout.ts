/**
 * Spike #1 · Q4 (Day Canvas 60fps direct manipulation — added by ADR-0011) —
 * pure geometry.
 *
 * The Day Canvas (ux-vision §2.1) represents time as blocks you drag, stretch,
 * and split — the hardest UI in the app. On React Native the 60fps bar is met by
 * running gesture math in `react-native-reanimated` *worklets* on the UI thread,
 * never round-tripping to JS per frame. Worklets forbid closures over JS-thread
 * state, so the math must be pure, self-contained functions of numbers — exactly
 * what this file is. Every function here is worklet-compatible: given a pointer
 * position it returns the new block geometry with no allocation of note.
 *
 * Units: a block is `[startMin, endMin)` minutes-from-midnight; the canvas maps
 * minutes to Y pixels at `pxPerMin`. Snapping is to a fixed grid (default 5 min).
 */

export interface Block {
  readonly id: string
  readonly startMin: number
  readonly endMin: number
}

export interface CanvasGeom {
  readonly pxPerMin: number
  readonly snapMin: number
  readonly dayStartMin: number // usually 0 (00:00)
  readonly dayEndMin: number // usually 1440 (24:00)
  readonly minBlockMin: number // smallest allowed block, e.g. 5
}

export const DEFAULT_GEOM: CanvasGeom = {
  pxPerMin: 1,
  snapMin: 5,
  dayStartMin: 0,
  dayEndMin: 1440,
  minBlockMin: 5,
}

export function minToY(min: number, g: CanvasGeom): number {
  return (min - g.dayStartMin) * g.pxPerMin
}
export function yToMin(y: number, g: CanvasGeom): number {
  return g.dayStartMin + y / g.pxPerMin
}
export function snap(min: number, g: CanvasGeom): number {
  return Math.round(min / g.snapMin) * g.snapMin
}
function clampMin(min: number, g: CanvasGeom): number {
  return Math.min(g.dayEndMin, Math.max(g.dayStartMin, min))
}

/** Move a block by a pointer delta (px), snapping and clamping to the day. */
export function moveBlock(b: Block, dyPx: number, g: CanvasGeom): Block {
  const duration = b.endMin - b.startMin
  let start = clampMin(snap(b.startMin + dyPx / g.pxPerMin, g), g)
  start = Math.min(start, g.dayEndMin - duration) // keep the tail in-bounds
  return { ...b, startMin: start, endMin: start + duration }
}

/** Drag an edge to resize. `edge` is which handle; respects min duration + bounds. */
export function resizeBlock(b: Block, edge: 'start' | 'end', dyPx: number, g: CanvasGeom): Block {
  const dMin = dyPx / g.pxPerMin
  if (edge === 'start') {
    const start = clampMin(snap(b.startMin + dMin, g), g)
    return { ...b, startMin: Math.min(start, b.endMin - g.minBlockMin) }
  }
  const end = clampMin(snap(b.endMin + dMin, g), g)
  return { ...b, endMin: Math.max(end, b.startMin + g.minBlockMin) }
}

/**
 * Split a block at pointer Y into two blocks. Duration is conserved exactly; the
 * cut snaps to the grid and is refused (returns the original as a singleton) if
 * either half would fall below the minimum.
 */
export function splitBlock(b: Block, atY: number, g: CanvasGeom): readonly Block[] {
  const cut = clampMin(snap(yToMin(atY, g), g), g)
  if (cut - b.startMin < g.minBlockMin || b.endMin - cut < g.minBlockMin) return [b]
  return [
    { ...b, endMin: cut },
    { ...b, id: `${b.id}:b`, startMin: cut },
  ]
}

/** Do two blocks overlap in time? (For the canvas's collision affordance.) */
export function overlaps(a: Block, b: Block): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin
}
