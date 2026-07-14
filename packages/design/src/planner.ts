/**
 * Planner geometry (ux-vision §3, issue #11) — pure layout math for the week
 * canvas, kept here (pure + tested) so the React Native screen stays declarative
 * and the numbers that place a block are deterministic (ADR-0005), exactly like
 * the instrument math in `instruments.ts`.
 *
 * A planner day is a fixed visible window of `spanMin` minutes (e.g. 08:00–18:00
 * → 600). A block starting at `startMin` for `lengthMin` minutes occupies a
 * vertical slice of that window; `plannerBlockRect` returns its `top` offset and
 * `height` as `[0, 1]` fractions of the window, clamped so a block that begins
 * before the window or runs past its end still renders sensibly (never negative,
 * never past 1).
 */

/** A block's placement within a day column, as `[0, 1]` fractions of the span. */
export interface BlockRect {
  /** Distance from the top of the day window, `0`–`1`. */
  readonly top: number
  /** Fraction of the day window the block covers, `0`–`1`. */
  readonly height: number
}

/**
 * Place a `[startMin, startMin + lengthMin)` block inside a `spanMin` window.
 * Start is clamped to the window; the end is clamped to the window and never
 * falls before the (clamped) start, so `height >= 0`.
 */
export function plannerBlockRect(startMin: number, lengthMin: number, spanMin: number): BlockRect {
  if (!(spanMin > 0)) throw new Error('spanMin must be positive')
  if (lengthMin < 0) throw new Error('lengthMin must not be negative')
  const start = Math.min(Math.max(startMin, 0), spanMin)
  const end = Math.min(Math.max(startMin + lengthMin, start), spanMin)
  return { top: start / spanMin, height: (end - start) / spanMin }
}

/** Total hours across a set of block lengths (minutes → hours), for day totals. */
export function plannerTotalHours(lengthsMin: readonly number[]): number {
  return lengthsMin.reduce((sum, m) => sum + m, 0) / 60
}

/**
 * Task priority (design v6 Monat/Jahr): P1 (highest) … P3 (lowest). Only *tasks*
 * carry a priority and count toward day load; *events* (holiday, company event,
 * info) never do — they are surfaced but weigh nothing (planner ground law).
 */
export type Priority = 1 | 2 | 3

/** The priority weight in the day-load sum: high priority weighs heavier. */
export function priorityWeight(prio: Priority): number {
  return prio === 1 ? 1.4 : prio === 2 ? 1 : 0.7
}

/** A planned task's contribution to day load: its priority and estimate in hours. */
export interface TaskLoad {
  readonly prio: Priority
  readonly estHours: number
}

/**
 * Prio-weighted day load in hours (design v6): each task's estimate scaled by its
 * priority weight, summed. Negative estimates are floored at 0 so a bad datum
 * can't pull the load down. This is the number the day's "Schwere" bar and the
 * month heat compare against the daily target (`soll`).
 */
export function dayLoad(tasks: readonly TaskLoad[]): number {
  return tasks.reduce((sum, t) => sum + Math.max(t.estHours, 0) * priorityWeight(t.prio), 0)
}

/** Load tone vs the daily target: idle (nothing), good (≤85%), warn (≤100%), crit (over). */
export type LoadTone = 'idle' | 'good' | 'warn' | 'crit'

export function loadTone(load: number, soll: number): LoadTone {
  if (!(load > 0)) return 'idle'
  if (!(soll > 0)) return 'crit'
  if (load <= soll * 0.85) return 'good'
  if (load <= soll) return 'warn'
  return 'crit'
}

/**
 * Snap a raw (drag-derived) duration to the planner's grid (design v6 resize):
 * round to the nearest `gridMin` step, then clamp to `[minMin, maxMin]`. Pure so
 * the gesture layer stays a thin wrapper and the 15-minute raster is deterministic
 * (ADR-0005). `maxMin` guards a block from being dragged past the day window.
 */
export function snapDurationMin(
  rawMin: number,
  gridMin = 15,
  minMin = 15,
  maxMin = Number.POSITIVE_INFINITY,
): number {
  if (!(gridMin > 0)) throw new Error('gridMin must be positive')
  const snapped = Math.round(rawMin / gridMin) * gridMin
  return Math.min(Math.max(snapped, minMin), Math.max(minMin, maxMin))
}

/** A time interval on a day column, in minutes from the top of the window. */
export interface Interval {
  readonly startMin: number
  readonly lenMin: number
}

/** A block's column placement: which `lane` it sits in, of how many `lanes`. */
export interface LanePlacement {
  /** 0-based column index within its overlap cluster. */
  readonly lane: number
  /** Number of lanes the cluster splits into (1 = full width). */
  readonly lanes: number
}

/**
 * Pack overlapping day blocks into side-by-side lanes (design v6 "Überbuchung"):
 * a maximal run of transitively-overlapping intervals forms a cluster, and within
 * a cluster each block takes the first lane free at its start — so parallel blocks
 * split the column instead of hiding each other. Non-overlapping blocks stay full
 * width (`lanes: 1`). Deterministic (ADR-0005): input order is preserved in the
 * output, ties broken by longer-first then original index, so the layout is stable.
 */
export function assignLanes(items: readonly Interval[]): LanePlacement[] {
  const order = items
    .map((it, index) => ({ index, start: it.startMin, end: it.startMin + Math.max(it.lenMin, 0) }))
    .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.index - b.index)
  const out = new Array<LanePlacement>(items.length)

  let cluster: { index: number; start: number; end: number }[] = []
  let clusterEnd = Number.NEGATIVE_INFINITY
  const flush = (): void => {
    const laneEnds: number[] = []
    const laneOf: { index: number; lane: number }[] = []
    for (const b of cluster) {
      let lane = laneEnds.findIndex(end => end <= b.start + 1e-9)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(0)
      }
      laneEnds[lane] = b.end
      laneOf.push({ index: b.index, lane })
    }
    for (const { index, lane } of laneOf) out[index] = { lane, lanes: laneEnds.length }
    cluster = []
  }

  for (const b of order) {
    if (cluster.length > 0 && b.start >= clusterEnd - 1e-9) {
      flush()
      clusterEnd = Number.NEGATIVE_INFINITY
    }
    cluster.push(b)
    clusterEnd = Math.max(clusterEnd, b.end)
  }
  if (cluster.length > 0) flush()
  return out
}

/**
 * The maximum number of intervals overlapping at any instant (design v6 day-head
 * "N×" overbooking badge). 1 (or 0) means no conflict. A sweep over sorted
 * start/end events; zero-length intervals never add to the peak.
 */
export function maxConcurrency(items: readonly Interval[]): number {
  const events: { at: number; delta: number }[] = []
  for (const it of items) {
    const len = Math.max(it.lenMin, 0)
    if (len <= 0) continue
    events.push({ at: it.startMin, delta: 1 }, { at: it.startMin + len, delta: -1 })
  }
  // Ends before starts at the same instant, so touching blocks don't count as overlap.
  events.sort((a, b) => a.at - b.at || a.delta - b.delta)
  let current = 0
  let peak = 0
  for (const e of events) {
    current += e.delta
    if (current > peak) peak = current
  }
  return peak
}
