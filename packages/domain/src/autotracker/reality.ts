/**
 * Auto-Tracker reality core (REQ-042, ADR-0057 as extended) — the deterministic
 * logic behind the Planner's "reality layer": what the tracker actually observed,
 * how far it drifted from what was booked, and the largest unbooked stretch worth
 * healing. Pure and framework-free (ADR-0005): the client captures timestamped
 * spans and stores them per day; this module turns them into a trace, a drift
 * number, and a single healing candidate — no I/O, no wall-clock, no mutation.
 *
 * All times are milliseconds on one shared clock (the client passes ms-since-epoch
 * or ms-within-day consistently). "Active" = a real working source; Idle/Away are
 * excluded from tracked time and never count as reality worth booking.
 */

/** A captured activity span with wall-clock bounds. The client stamps start/end at
 *  capture time; `source` is a coarse label (app name, or `Idle`/`Away`). */
export interface TimedSpan {
  readonly source: string
  readonly startMs: number
  readonly endMs: number
}

/** A booked interval on the day (a tracked/planned block), on the same clock. */
export interface BookedSpan {
  readonly startMs: number
  readonly endMs: number
}

/** The single largest unbooked stretch the tracker saw — the yesterday-healing candidate. */
export interface RealityGap {
  readonly startMs: number
  readonly endMs: number
  /** The active source that dominated the gap (most observed ms), for the banner copy. */
  readonly source: string
}

export interface RealityOptions {
  /** Sources that are *not* real work and never count (default `Idle`, `Away`). */
  readonly idleSources?: readonly string[]
}

const DEFAULT_IDLE: readonly string[] = ['Idle', 'Away']

/** A span's non-negative duration. */
function spanMs(s: TimedSpan): number {
  return Math.max(0, s.endMs - s.startMs)
}

/** The active (real-work) spans: positive length, source not in the idle set. */
function activeSpans(spans: readonly TimedSpan[], idle: ReadonlySet<string>): readonly TimedSpan[] {
  return spans.filter(s => s.endMs > s.startMs && !idle.has(s.source))
}

/** Sort + merge overlapping/touching intervals into a disjoint, ascending set. */
function mergeIntervals(
  intervals: readonly { startMs: number; endMs: number }[],
): { startMs: number; endMs: number }[] {
  const sorted = intervals
    .filter(i => i.endMs > i.startMs)
    .map(i => ({ startMs: i.startMs, endMs: i.endMs }))
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  const out: { startMs: number; endMs: number }[] = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last !== undefined && iv.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, iv.endMs)
    } else {
      out.push({ ...iv })
    }
  }
  return out
}

/** `base` intervals with every `cut` interval removed (interval subtraction). */
function subtractIntervals(
  base: readonly { startMs: number; endMs: number }[],
  cut: readonly { startMs: number; endMs: number }[],
): { startMs: number; endMs: number }[] {
  const cuts = mergeIntervals(cut)
  const out: { startMs: number; endMs: number }[] = []
  for (const seg of base) {
    let start = seg.startMs
    for (const c of cuts) {
      if (c.endMs <= start || c.startMs >= seg.endMs) continue
      if (c.startMs > start) out.push({ startMs: start, endMs: Math.min(c.startMs, seg.endMs) })
      start = Math.max(start, c.endMs)
      if (start >= seg.endMs) break
    }
    if (start < seg.endMs) out.push({ startMs: start, endMs: seg.endMs })
  }
  return out.filter(i => i.endMs > i.startMs)
}

/** Milliseconds of a span that fall inside `[a, b)`. */
function overlapMs(s: TimedSpan, a: number, b: number): number {
  return Math.max(0, Math.min(s.endMs, b) - Math.max(s.startMs, a))
}

/** Total real-work time the tracker observed (idle/away excluded), in ms. */
export function trackedMs(spans: readonly TimedSpan[], opts: RealityOptions = {}): number {
  const idle = new Set(opts.idleSources ?? DEFAULT_IDLE)
  return activeSpans(spans, idle).reduce((n, s) => n + spanMs(s), 0)
}

/**
 * Drift between reality and the books: tracked real-work time minus booked time.
 * A positive delta means the tracker saw more than was booked (unbooked work);
 * negative means more was booked than observed. The client renders the signed
 * `deltaMs` as the day-head drift chip (live orange).
 */
export function realityDrift(
  spans: readonly TimedSpan[],
  bookedMs: number,
  opts: RealityOptions = {},
): { readonly trackedMs: number; readonly bookedMs: number; readonly deltaMs: number } {
  const tracked = trackedMs(spans, opts)
  const booked = Math.max(0, bookedMs)
  return { trackedMs: tracked, bookedMs: booked, deltaMs: tracked - booked }
}

/**
 * The single largest stretch where the tracker saw real work but nothing was booked —
 * the yesterday-healing candidate (K3). Builds the active coverage, subtracts the
 * booked intervals, keeps stretches ≥ `minGapMs`, and returns the longest, labelled
 * with the source that dominated it. `null` when nothing qualifies (the common case →
 * no banner). Deterministic: ties in length break toward the earlier stretch.
 */
export function detectUnbookedGap(
  spans: readonly TimedSpan[],
  booked: readonly BookedSpan[],
  opts: RealityOptions & { readonly minGapMs: number },
): RealityGap | null {
  const idle = new Set(opts.idleSources ?? DEFAULT_IDLE)
  const active = activeSpans(spans, idle)
  const coverage = mergeIntervals(active)
  const unbooked = subtractIntervals(coverage, booked).filter(
    g => g.endMs - g.startMs >= opts.minGapMs,
  )
  if (unbooked.length === 0) return null

  // Longest wins; earlier start breaks ties (deterministic, stable).
  const best = unbooked.reduce((a, b) => {
    const la = a.endMs - a.startMs
    const lb = b.endMs - b.startMs
    return lb > la || (lb === la && b.startMs < a.startMs) ? b : a
  })

  // Label with the active source that logged the most ms inside the gap.
  const bySource = new Map<string, number>()
  for (const s of active) {
    const ms = overlapMs(s, best.startMs, best.endMs)
    if (ms > 0) bySource.set(s.source, (bySource.get(s.source) ?? 0) + ms)
  }
  const source =
    [...bySource.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
    'Unknown'

  return { startMs: best.startMs, endMs: best.endMs, source }
}
