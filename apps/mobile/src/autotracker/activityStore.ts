import type { ActivitySample } from '@mydevtime/domain'

/**
 * Auto-Tracker local buffer (REQ-042, ADR-0057 — **local-only**). The captured
 * spans of the current session, persisted **only on this device** so the breakdown
 * survives a reload (or an app relaunch mid-session). Nothing is ever sent to a
 * server: this is a deliberate privacy choice — app-activity is behaviour-near data,
 * so it stays where it was observed and is cleared the moment the session ends.
 *
 * Same cross-platform seam as `onboardingStore`: `localStorage` on web (the current
 * render target), an in-memory fallback on native until a durable native store is
 * wired. One namespaced key, read/written only through here.
 */
const KEY = 'mydevtime.autotracker.session'

/** Best-effort `localStorage`, or null when unavailable (native / SSR). */
function web(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

let memoryBuffer: ActivitySample[] = []

/**
 * Merge raw spans into one bounded entry per source (dropping non-positive spans),
 * sorted by source name for a deterministic buffer. Pure — this keeps both the
 * in-memory buffer and the stored blob tiny regardless of session length, and
 * `summarizeActivity` re-merges/orders on read so the breakdown is unchanged.
 */
export function mergeBySource(samples: readonly ActivitySample[]): ActivitySample[] {
  const bySource = new Map<string, number>()
  for (const { source, ms } of samples) {
    if (ms > 0) bySource.set(source, (bySource.get(source) ?? 0) + ms)
  }
  return [...bySource.entries()]
    .map(([source, ms]) => ({ source, ms }))
    .sort((a, b) => a.source.localeCompare(b.source))
}

/** Parse a stored blob back into samples, tolerating anything malformed (→ []). */
function parse(raw: string | null): ActivitySample[] {
  if (raw === null) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    const out: ActivitySample[] = []
    for (const item of value) {
      if (item !== null && typeof item === 'object') {
        const rec = item as Record<string, unknown>
        if (typeof rec.source === 'string' && typeof rec.ms === 'number' && rec.ms > 0) {
          out.push({ source: rec.source, ms: rec.ms })
        }
      }
    }
    return out
  } catch {
    return []
  }
}

/** The current session's persisted spans on this device, or [] if none. */
export function loadActivitySamples(): ActivitySample[] {
  const store = web()
  if (store) return parse(store.getItem(KEY))
  return [...memoryBuffer]
}

/** Persist the session's spans (merged by source, bounded) on this device. */
export function saveActivitySamples(samples: readonly ActivitySample[]): void {
  const merged = mergeBySource(samples)
  const store = web()
  if (store) {
    store.setItem(KEY, JSON.stringify(merged))
    return
  }
  memoryBuffer = merged
}

/** Forget the session's local buffer (called when the session ends). */
export function clearActivitySamples(): void {
  const store = web()
  if (store) {
    store.removeItem(KEY)
    return
  }
  memoryBuffer = []
}
