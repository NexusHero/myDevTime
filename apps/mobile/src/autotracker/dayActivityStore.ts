import type { TimedSpan } from '@mydevtime/domain'

/**
 * Auto-Tracker per-day reality history (REQ-042, ADR-0064 — **local-only**). Unlike
 * the session buffer (`activityStore`, merged-by-source, wiped at session end), this
 * keeps **timestamped spans keyed by local day**, so the Planner can draw yesterday's
 * reality trace and heal an unbooked gap. It is still on-device only — never uploaded
 * (ADR-0058/0059 privacy stance): app-activity is behaviour-near data, so it stays
 * where it was observed. A small rolling window (the last {@link KEEP_DAYS} days) is
 * kept; older days are pruned on write so the store never grows without bound.
 *
 * Same cross-platform seam as `activityStore`: `localStorage` on web, an in-memory
 * fallback on native. One namespaced key per day, read/written only through here.
 */
const PREFIX = 'mydevtime.autotracker.day.'
/** How many recent days of reality to retain locally. */
export const KEEP_DAYS = 7
/** Hard ceiling on spans kept per day (keeps the blob tiny; newest win if exceeded). */
const MAX_SPANS_PER_DAY = 4000

/** The local calendar day (`YYYY-MM-DD`) a timestamp falls in — the store's key. */
export function localDayKey(ms: number): string {
  const d = new Date(ms)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${String(d.getFullYear())}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Best-effort `localStorage`, or null when unavailable (native / SSR). */
function web(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

const memory = new Map<string, TimedSpan[]>()

/**
 * Merge consecutive same-source spans that touch (prev end === next start) into one,
 * sorted by start. Pure — keeps the stored blob compact without changing what a
 * timeline or the reality core sees (they treat touching same-source spans as one).
 */
export function mergeAdjacentSpans(spans: readonly TimedSpan[]): TimedSpan[] {
  const sorted = spans
    .filter(s => s.endMs > s.startMs)
    .map(s => ({ ...s }))
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  const out: TimedSpan[] = []
  for (const s of sorted) {
    const last = out[out.length - 1]
    if (last?.source === s.source && s.startMs <= last.endMs) {
      out[out.length - 1] = { ...last, endMs: Math.max(last.endMs, s.endMs) }
    } else {
      out.push(s)
    }
  }
  return out.length > MAX_SPANS_PER_DAY ? out.slice(out.length - MAX_SPANS_PER_DAY) : out
}

/** Parse a stored blob into TimedSpans, tolerating anything malformed (→ []). */
function parse(raw: string | null): TimedSpan[] {
  if (raw === null) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    const out: TimedSpan[] = []
    for (const item of value) {
      if (item !== null && typeof item === 'object') {
        const rec = item as Record<string, unknown>
        if (
          typeof rec.source === 'string' &&
          typeof rec.startMs === 'number' &&
          typeof rec.endMs === 'number' &&
          rec.endMs > rec.startMs
        ) {
          out.push({ source: rec.source, startMs: rec.startMs, endMs: rec.endMs })
        }
      }
    }
    return out
  } catch {
    return []
  }
}

/** Every day key currently stored (web `localStorage` or the native memory map). */
function storedDayKeys(store: Storage | null): string[] {
  if (store) {
    const keys: string[] = []
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i)
      if (k?.startsWith(PREFIX) === true) keys.push(k.slice(PREFIX.length))
    }
    return keys
  }
  return [...memory.keys()]
}

/** Drop days beyond the newest {@link KEEP_DAYS} (day keys sort chronologically). */
function prune(store: Storage | null): void {
  const keys = storedDayKeys(store).sort() // ascending → oldest first
  const excess = keys.length - KEEP_DAYS
  if (excess <= 0) return
  for (const day of keys.slice(0, excess)) {
    if (store) store.removeItem(PREFIX + day)
    else memory.delete(day)
  }
}

/** The reality spans stored for a local day (`YYYY-MM-DD`), or [] if none. */
export function loadDaySpans(dayKey: string): TimedSpan[] {
  const store = web()
  if (store) return parse(store.getItem(PREFIX + dayKey))
  return [...(memory.get(dayKey) ?? [])]
}

/**
 * Append captured spans to their day's history (each span filed under the local day
 * of its start), merging adjacent same-source spans and pruning old days. Spans that
 * cross midnight are filed by their start day — a rare, harmless approximation.
 */
export function appendDaySpans(spans: readonly TimedSpan[]): void {
  if (spans.length === 0) return
  const store = web()
  const byDay = new Map<string, TimedSpan[]>()
  for (const s of spans) {
    if (s.endMs <= s.startMs) continue
    const day = localDayKey(s.startMs)
    let bucket = byDay.get(day)
    if (bucket === undefined) {
      bucket = []
      byDay.set(day, bucket)
    }
    bucket.push(s)
  }
  for (const [day, added] of byDay) {
    const merged = mergeAdjacentSpans([...loadDaySpans(day), ...added])
    if (store) store.setItem(PREFIX + day, JSON.stringify(merged))
    else memory.set(day, merged)
  }
  prune(store)
}

/** Forget all locally stored reality history (a privacy / "clear data" action). */
export function clearDayHistory(): void {
  const store = web()
  if (store) {
    for (const day of storedDayKeys(store)) store.removeItem(PREFIX + day)
    return
  }
  memory.clear()
}
