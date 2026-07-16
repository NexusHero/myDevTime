import { Platform } from 'react-native'
import type { ActivitySample } from '@mydevtime/domain'
import { nativeUsageCapture, type NativeUsageModule } from './nativeUsage.js'

/**
 * Auto-Tracker capture (REQ-042, ADR-0057) — the volatile, platform-specific seam
 * behind a narrow port (SKILL §2.2). The deterministic aggregation lives in
 * `@mydevtime/domain` (`summarizeActivity`); this file only *observes* activity and
 * emits closed spans. Capture is **consent-gated** (the `autoTracker` preference)
 * and **local-only** — spans never leave the device.
 *
 * Honesty over reach: a managed Expo app cannot see *other* apps on iOS or the web
 * (sandboxed) — those get the `nullCapture` no-op and an honest empty state. The
 * web adapter captures only the app's *own* tab activity (focused / away / idle),
 * which is real and privacy-safe. Real OS-level app capture (Android UsageStats, a
 * desktop companion) is a future adapter behind this same port.
 */

export type SampleSink = (sample: ActivitySample) => void

export interface ActivityCapture {
  /** Begin capturing; `onSample` receives each closed span. Returns a `stop()` that
   *  flushes the final open span and detaches every listener/timer. Idempotent. */
  start(onSample: SampleSink): () => void
}

/**
 * The pure span accumulator — the testable heart of any capture adapter. It holds a
 * single open span (a source + the time it began) and emits a closed span whenever
 * the source changes, on a periodic flush, or on end. Time is injected (ms), so it
 * needs no clock and is fully deterministic under test.
 */
export class SpanAccumulator {
  private source: string | null = null
  private since = 0

  constructor(private readonly emit: SampleSink) {}

  /** Switch to `source` at `now`, closing + emitting the previous span if any. */
  transition(source: string, now: number): void {
    if (source === this.source) return
    this.flush(now)
    this.source = source
    this.since = now
  }

  /** Emit the current span's elapsed time without ending it (periodic checkpoint),
   *  so a long uninterrupted span still accumulates. No-op when nothing is open. */
  flush(now: number): void {
    if (this.source !== null && now > this.since) {
      this.emit({ source: this.source, ms: now - this.since })
      this.since = now
    }
  }

  /** Close the open span (on stop). After this the accumulator is idle. */
  end(now: number): void {
    this.flush(now)
    this.source = null
  }
}

/** Sources the web adapter reports — deliberately coarse and first-party. */
export const WEB_SOURCE = {
  active: 'Active',
  away: 'Away',
  idle: 'Idle',
} as const

/** Capture that observes nothing — the honest default where OS capture is impossible
 *  (iOS, unknown platforms). Emits no spans, so the UI shows its empty state. */
export function nullCapture(): ActivityCapture {
  return { start: () => () => undefined }
}

export interface WebCaptureOptions {
  /** Idle threshold: no input for this long (while visible) counts as `Idle`. */
  readonly idleMs?: number
  /** How often to checkpoint the open span so it accumulates live. */
  readonly flushMs?: number
  /** Injected clock (tests); defaults to `Date.now`. */
  readonly now?: () => number
}

/**
 * Web adapter — captures the app's **own** tab activity via the Page Visibility API
 * plus a lightweight input-idle heuristic. Reports `Active` (focused + recent input),
 * `Idle` (focused but no input past the threshold) and `Away` (tab hidden). It never
 * inspects other apps. Returns `nullCapture` if there is no DOM.
 */
export function webCapture(opts: WebCaptureOptions = {}): ActivityCapture {
  if (typeof document === 'undefined') return nullCapture()
  const idleMs = opts.idleMs ?? 60_000
  const flushMs = opts.flushMs ?? 30_000
  const now = opts.now ?? ((): number => Date.now())

  return {
    start(onSample: SampleSink): () => void {
      const acc = new SpanAccumulator(onSample)
      let lastInput = now()
      let stopped = false

      const currentSource = (): string => {
        if (document.visibilityState === 'hidden') return WEB_SOURCE.away
        return now() - lastInput >= idleMs ? WEB_SOURCE.idle : WEB_SOURCE.active
      }
      const sync = (): void => {
        if (!stopped) acc.transition(currentSource(), now())
      }
      const onInput = (): void => {
        lastInput = now()
        sync()
      }

      acc.transition(currentSource(), now())

      const inputEvents = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'wheel'] as const
      for (const e of inputEvents) window.addEventListener(e, onInput, { passive: true })
      document.addEventListener('visibilitychange', sync)
      const timer = setInterval(() => {
        acc.flush(now()) // keep the open span accumulating
        sync() // and re-evaluate active→idle transitions
      }, flushMs)

      return (): void => {
        if (stopped) return
        stopped = true
        clearInterval(timer)
        for (const e of inputEvents) window.removeEventListener(e, onInput)
        document.removeEventListener('visibilitychange', sync)
        acc.end(now())
      }
    },
  }
}

/**
 * The OS app-usage native module for the current build, or `null` when there is none
 * (the managed / web build). A Dev Client build that includes `modules/mydevtime-usage`
 * replaces this body with `requireNativeModule('MydevtimeUsage')` (ADR-0058) — the one
 * line that turns the dormant Android path live. Kept as a null-returning seam so the
 * managed build degrades to an honest empty state instead of a fake breakdown.
 */
function nativeUsageModule(): NativeUsageModule | null {
  return null
}

/** The capture adapter for the current platform: the real web adapter on web, the
 *  native OS usage adapter on Android **when a Dev Client build provides the module**
 *  (else the honest no-op), and the no-op elsewhere — iOS cannot see other apps
 *  (ADR-0057/0058). */
export function platformCapture(opts?: WebCaptureOptions): ActivityCapture {
  if (Platform.OS === 'web') return webCapture(opts)
  if (Platform.OS === 'android') {
    const native = nativeUsageModule()
    if (native !== null) return nativeUsageCapture(native)
  }
  return nullCapture()
}
