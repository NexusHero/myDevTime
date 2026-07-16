import type { ActivitySample } from '@mydevtime/domain'
import type { ActivityCapture, SampleSink } from './capture.js'

/**
 * Native OS app-usage capture (REQ-042, ADR-0057 as extended by ADR-0058) — the
 * **adapter seam** for real per-app tracking on platforms that expose it (Android's
 * `UsageStatsManager` today). The vendor/native surface is confined to one narrow
 * port; everything upstream (`ActivityCapture`, `summarizeActivity`) is unchanged.
 *
 * The native module reports **cumulative** foreground time per app; this file turns
 * those cumulative readings into the per-interval spans the deterministic core wants,
 * with pure, exhaustively tested diff logic — so the only thing that stays unverified
 * without a device is the thin native module itself, not the accounting.
 *
 * Capture stays consent- and session-gated (the `autoTracker` opt-in, only while
 * tracking) and **local-only** — spans are summarized on-device and never uploaded,
 * per the data-protection stance in ADR-0057.
 */

/** One cumulative reading: an app's total foreground ms since the query window start. */
export interface NativeUsageReading {
  readonly source: string
  readonly totalMs: number
}

/**
 * The narrow native port. A Dev Client build provides a module of this shape (see
 * `modules/mydevtime-usage/`); the managed / web build has none. `query` returns the
 * current cumulative per-app totals; `hasPermission`/`requestPermission` gate the
 * special `PACKAGE_USAGE_STATS` grant.
 */
export interface NativeUsageModule {
  hasPermission(): Promise<boolean>
  requestPermission(): Promise<void>
  query(): Promise<readonly NativeUsageReading[]>
}

/**
 * Turn two cumulative readings into the spans elapsed between them: for each source,
 * emit the positive delta since its previous total. The first diff (no previous total
 * for a source) only establishes the baseline — it emits nothing, so a session never
 * counts usage that accrued before it started. A counter reset (next < previous, e.g.
 * the OS window rolled over) is treated as a fresh baseline (no negative span).
 * Returns the emitted spans plus the next baseline map. Pure.
 */
export function diffUsage(
  previous: ReadonlyMap<string, number>,
  next: readonly NativeUsageReading[],
): { readonly samples: ActivitySample[]; readonly baseline: Map<string, number> } {
  const baseline = new Map<string, number>()
  const samples: ActivitySample[] = []
  for (const { source, totalMs } of next) {
    const prev = previous.get(source)
    if (prev !== undefined && totalMs > prev) samples.push({ source, ms: totalMs - prev })
    baseline.set(source, totalMs)
  }
  return { samples, baseline }
}

export interface NativeCaptureOptions {
  /** How often to poll the native module (ms). */
  readonly pollMs?: number
  /** Injected timers/clock for tests. */
  readonly setInterval?: (fn: () => void, ms: number) => ReturnType<typeof setInterval>
  readonly clearInterval?: (id: ReturnType<typeof setInterval>) => void
}

/**
 * An {@link ActivityCapture} over a {@link NativeUsageModule}: polls cumulative
 * usage on an interval and feeds the between-poll deltas to the sink. The first poll
 * sets the baseline (no spans). Stops cleanly and drops the module reference.
 */
export function nativeUsageCapture(
  module: NativeUsageModule,
  opts: NativeCaptureOptions = {},
): ActivityCapture {
  const pollMs = opts.pollMs ?? 60_000
  const setTimer = opts.setInterval ?? ((fn, ms) => setInterval(fn, ms))
  const clearTimer =
    opts.clearInterval ??
    ((id): void => {
      clearInterval(id)
    })

  return {
    start(onSample: SampleSink): () => void {
      let previous = new Map<string, number>()
      let stopped = false

      const poll = async (): Promise<void> => {
        if (stopped) return
        const readings = await module.query()
        // `stopped` can flip during the awaited query (the returned stop() closure sets
        // it); the analyzer can't see that mutation, so this guard is not redundant.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (stopped) return
        const { samples, baseline } = diffUsage(previous, readings)
        previous = baseline
        for (const s of samples) onSample(s)
      }

      const id = setTimer(() => void poll(), pollMs)
      void poll() // establish the baseline immediately

      return (): void => {
        if (stopped) return
        stopped = true
        clearTimer(id)
      }
    },
  }
}
