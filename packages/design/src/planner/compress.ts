/**
 * Zeit-Kompression (ADR-0072 D3, REQ-074, issue #341) — the pure layout math behind
 * the calm canvas's collapsed edge hours: unplanned early-morning (≈0–7 h) and late-
 * evening (≈20–24 h) bands shrink to a thin strip so the visible day is the lived
 * day and blocks gain height. Both canvases consume this — the RN `DayColumn` maps
 * minutes→pixels through {@link compressedY}/{@link compressedRect}, and the web
 * FullCalendar timegrid derives its `slotMinTime`/`slotMaxTime` from the expanded
 * band (ADR-0068 — the library only lays out; the window is ours). Deterministic
 * and total (ADR-0005): the same blocks always yield the same bands and mapping.
 */

import type { Interval } from '../planner.js'

/** One vertical band of a day column: a minute range, either expanded or compressed. */
export interface CompressBand {
  /** Band start, minute of the window (inclusive). */
  readonly startMin: number
  /** Band end, minute of the window (exclusive). */
  readonly endMin: number
  /** Compressed bands render as a thin strip; expanded bands at full minute height. */
  readonly compressed: boolean
}

/** Default working-band edges: hours before 07:00 / after 20:00 collapse when unplanned. */
export const MORNING_EDGE_MIN = 7 * 60
export const EVENING_EDGE_MIN = 20 * 60

/**
 * The vertical weight (in minute-equivalents) a compressed band occupies — a thin
 * strip, regardless of how many real hours it swallows. A compressed band shorter
 * than this keeps its real length (compression never *inflates* a band).
 */
export const COMPRESSED_BAND_WEIGHT_MIN = 24

export interface CompressOptions {
  /** Morning edge (minute): the expanded band never starts later than this. */
  readonly morningEdgeMin?: number
  /** Evening edge (minute): the expanded band never ends earlier than this. */
  readonly eveningEdgeMin?: number
}

/**
 * Partition the `[dayStartMin, dayEndMin)` window into at most three bands:
 * a compressed morning edge, the expanded lived band, and a compressed evening
 * edge. The expanded band always covers the working band (morning→evening edge)
 * and grows — snapped to whole hours — to keep every block's hour visible: a
 * block at 06:30 expands the morning down to 06:00; a block ending 22:10 expands
 * the evening to 23:00. An empty day compresses to exactly the working band.
 * Zero-length bands are omitted. Throws on an inverted window or a negative
 * block length — a bad datum fails loudly, never renders somewhere (ADR-0005).
 */
export function compressWindow(
  blocks: readonly Interval[],
  dayStartMin: number,
  dayEndMin: number,
  opts: CompressOptions = {},
): readonly CompressBand[] {
  if (!(dayEndMin > dayStartMin)) throw new Error('dayEndMin must be after dayStartMin')
  const clamp = (min: number): number => Math.min(Math.max(min, dayStartMin), dayEndMin)
  const morningEdge = clamp(opts.morningEdgeMin ?? MORNING_EDGE_MIN)
  const eveningEdge = Math.max(clamp(opts.eveningEdgeMin ?? EVENING_EDGE_MIN), morningEdge)

  let expandStart = morningEdge
  let expandEnd = eveningEdge
  for (const b of blocks) {
    if (b.lenMin < 0) throw new Error('block lenMin must not be negative')
    if (b.lenMin === 0) continue
    const start = b.startMin
    const end = b.startMin + b.lenMin
    if (end <= dayStartMin || start >= dayEndMin) continue // outside the window
    // Snap outward to whole hours so a 06:30 block keeps its whole hour visible.
    expandStart = Math.min(expandStart, clamp(Math.floor(start / 60) * 60))
    expandEnd = Math.max(expandEnd, clamp(Math.ceil(end / 60) * 60))
  }

  const bands: CompressBand[] = []
  if (expandStart > dayStartMin) {
    bands.push({ startMin: dayStartMin, endMin: expandStart, compressed: true })
  }
  bands.push({ startMin: expandStart, endMin: expandEnd, compressed: false })
  if (dayEndMin > expandEnd) {
    bands.push({ startMin: expandEnd, endMin: dayEndMin, compressed: true })
  }
  return bands
}

/** A band's vertical weight in minute-equivalents (thin strip when compressed). */
function bandWeight(band: CompressBand): number {
  const len = band.endMin - band.startMin
  return band.compressed ? Math.min(COMPRESSED_BAND_WEIGHT_MIN, len) : len
}

/** The total vertical weight of a band list — the divisor of every `[0, 1]` fraction. */
export function compressedTotalWeight(bands: readonly CompressBand[]): number {
  return bands.reduce((sum, band) => sum + bandWeight(band), 0)
}

/**
 * Map a minute of the window to a `[0, 1]` vertical fraction under compression.
 * Piecewise linear: within an expanded band a minute is a minute; within a
 * compressed band minutes shrink to the band's thin strip. Monotonically
 * non-decreasing; minutes outside the window clamp to its edges. Throws on an
 * empty band list.
 */
export function compressedY(bands: readonly CompressBand[], min: number): number {
  const total = compressedTotalWeight(bands)
  if (bands.length === 0 || !(total > 0)) throw new Error('bands must cover a non-empty window')
  let acc = 0
  for (const band of bands) {
    const weight = bandWeight(band)
    if (min < band.endMin) {
      const within = Math.max(0, min - band.startMin) / (band.endMin - band.startMin)
      return (acc + within * weight) / total
    }
    acc += weight
  }
  return 1
}

/**
 * A block's vertical placement under compression — the compressed-window sibling
 * of `plannerBlockRect`: `top`/`height` as `[0, 1]` fractions of the column.
 * The end never falls before the start, so `height >= 0`.
 */
export function compressedRect(
  bands: readonly CompressBand[],
  startMin: number,
  lenMin: number,
): { readonly top: number; readonly height: number } {
  if (lenMin < 0) throw new Error('lenMin must not be negative')
  const top = compressedY(bands, startMin)
  const bottom = compressedY(bands, startMin + lenMin)
  return { top, height: Math.max(0, bottom - top) }
}

/**
 * Inverse of {@link compressedY}: a `[0, 1]` vertical fraction back to the minute
 * of the window it points at (fractions clamp to the window's edges). This is what
 * tap-to-create uses to turn a touch position into a time under compression.
 */
export function compressedMinAt(bands: readonly CompressBand[], fraction: number): number {
  const total = compressedTotalWeight(bands)
  if (bands.length === 0 || !(total > 0)) throw new Error('bands must cover a non-empty window')
  const first = bands[0]
  if (first === undefined) throw new Error('bands must cover a non-empty window')
  const target = Math.min(Math.max(fraction, 0), 1) * total
  let acc = 0
  for (const band of bands) {
    const weight = bandWeight(band)
    if (target <= acc + weight || band === bands[bands.length - 1]) {
      const within = weight > 0 ? (target - acc) / weight : 0
      const min = band.startMin + Math.min(Math.max(within, 0), 1) * (band.endMin - band.startMin)
      return Math.min(Math.max(min, first.startMin), bands[bands.length - 1]?.endMin ?? min)
    }
    acc += weight
  }
  return first.startMin
}
