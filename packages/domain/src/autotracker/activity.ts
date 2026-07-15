/**
 * Auto-Tracker aggregation (REQ-042, ADR-0057) — the deterministic core behind the
 * "app usage while tracking" breakdown. Volatile OS/browser capture is a client
 * adapter behind a narrow port; this module is pure and framework-free (ADR-0005):
 * it turns raw activity spans into a stable, percentage-correct breakdown that a
 * timesheet-grade UI can trust. No I/O, no wall-clock — the caller passes durations.
 */

/** One observed span of a single activity source (e.g. an app name or "Away"). */
export interface ActivitySample {
  /** A stable label for what the user was doing — an app/window name, or "Away"/"Idle". */
  readonly source: string
  /** Span length in milliseconds. Non-positive spans are ignored. */
  readonly ms: number
}

/** A source's share of the observed window. */
export interface ActivitySegment {
  readonly source: string
  readonly ms: number
  /** Integer percent of the total (0–100); segments always sum to exactly 100. */
  readonly pct: number
}

/** The aggregated breakdown a client renders. */
export interface ActivityBreakdown {
  /** Total observed time across all samples, in ms. */
  readonly totalMs: number
  /** Per-source segments, most time first (ties broken by source name). */
  readonly segments: readonly ActivitySegment[]
}

export interface SummarizeOptions {
  /** Keep only the top-N sources; the remainder folds into a single "Others" bucket. */
  readonly topN?: number
  /** Label for the folded remainder bucket (default `"Others"`). */
  readonly othersLabel?: string
}

/** Integer percentages that sum to exactly 100 (largest-remainder / Hamilton method). */
function largestRemainderPercents(values: readonly number[], total: number): number[] {
  if (total <= 0) return values.map(() => 0)
  const raw = values.map(v => (v / total) * 100)
  const floors = raw.map(Math.floor)
  let remaining = 100 - floors.reduce((a, b) => a + b, 0)
  // Hand the leftover points to the largest fractional remainders, first-wins on ties
  // (input is already ordered by ms desc, so this is deterministic).
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  const out = [...floors]
  for (const { i } of order) {
    if (remaining <= 0) break
    out[i] = (out[i] ?? 0) + 1
    remaining -= 1
  }
  return out
}

/**
 * Aggregate raw activity spans into a percentage-correct breakdown: merge by source,
 * drop non-positive spans, sort by time (ties by source name for a stable order), and
 * — when `topN` is given — fold the tail into an "Others" bucket. Percentages are
 * computed over the final segment set so they always total 100.
 */
export function summarizeActivity(
  samples: readonly ActivitySample[],
  opts: SummarizeOptions = {},
): ActivityBreakdown {
  const bySource = new Map<string, number>()
  for (const { source, ms } of samples) {
    if (ms > 0) bySource.set(source, (bySource.get(source) ?? 0) + ms)
  }

  let ranked = [...bySource.entries()]
    .map(([source, ms]) => ({ source, ms }))
    .sort((a, b) => b.ms - a.ms || a.source.localeCompare(b.source))

  const totalMs = ranked.reduce((n, s) => n + s.ms, 0)
  if (totalMs <= 0) return { totalMs: 0, segments: [] }

  if (opts.topN !== undefined && opts.topN >= 0 && ranked.length > opts.topN) {
    // Every ranked source has positive ms (non-positive spans were dropped), so the
    // folded tail is always > 0 — no empty-"Others" case to guard.
    const head = ranked.slice(0, opts.topN)
    const tailMs = ranked.slice(opts.topN).reduce((n, s) => n + s.ms, 0)
    ranked = [...head, { source: opts.othersLabel ?? 'Others', ms: tailMs }]
  }

  const pcts = largestRemainderPercents(
    ranked.map(s => s.ms),
    totalMs,
  )
  const segments = ranked.map((s, i) => ({ source: s.source, ms: s.ms, pct: pcts[i] ?? 0 }))
  return { totalMs, segments }
}
