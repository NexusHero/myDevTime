/**
 * Bounded lists (design v1, "bounded screens") — the pure split behind every
 * "instruments, not lists" surface. A screen's scroll depth must not grow with
 * the user's workload (a page that gets longer the busier you are is a bug), so
 * long lists render as a distribution instrument: the top `limit` items plus a
 * "+N weitere" drill-in. This helper is the tested primitive; the client renders
 * `shown` and, when `hidden > 0`, the show-more affordance.
 */

export interface Bounded<T> {
  /** The items to render now — at most `limit`, or all of them when expanded. */
  readonly shown: readonly T[]
  /** How many items are collapsed behind the "+N weitere" affordance (0 when none). */
  readonly hidden: number
}

/**
 * Split `items` into the visible head and a hidden count. `limit` is floored and
 * clamped to ≥0. When `expanded`, everything shows and `hidden` is 0. When the
 * list already fits within `limit`, it is returned whole (no affordance needed).
 */
export function boundedList<T>(items: readonly T[], limit: number, expanded = false): Bounded<T> {
  const cap = Math.max(0, Math.floor(limit))
  if (expanded || items.length <= cap) return { shown: items, hidden: 0 }
  return { shown: items.slice(0, cap), hidden: items.length - cap }
}
