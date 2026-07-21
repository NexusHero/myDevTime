/**
 * The fill-week packing core (REQ-073, ADR-0072 D2) — "Fülle meine Woche" as pure,
 * deterministic logic (ADR-0005). The caller resolves everything volatile *before* calling:
 * per-day free windows come from `freeWindows` over the real obstacles (meetings, 🛡,
 * absences, the existing plan), estimates are the explicit ones or the deterministic
 * 60-minute default, and the AI refinement (REQ-041) only ever changes the *input* after an
 * explicit user accept. `packWeek` then lays the backlog into the week:
 *
 * - **windows only** — a placement never leaves a given free window;
 * - **the capacity line holds** — a day's placed sum never exceeds `capacityLineMin`;
 *   fill-week does NOT stretch (stretching is the day-repair's informed deal, #339);
 * - **priority order** — lower `priority` packs first, ties break by stable input order;
 * - **whole or honest** — an item is placed completely (splitting across windows/days is
 *   allowed, every fragment ≥ {@link MIN_SPLIT_FRAGMENT_MIN} minutes) or reported in
 *   `unplaced` with nothing placed; a half-placed ticket would lie on the canvas;
 * - **deterministic** — the same input yields the byte-equal result, always.
 *
 * Overlapping/inverted input windows are normalized (merged) defensively — a malformed
 * window must never double wall-clock time into extra capacity.
 */

export interface PackItem {
  readonly id: string
  readonly title: string
  /** Caller-resolved: the explicit estimate, or the deterministic 60-minute default. */
  readonly estimateMin: number
  /** Lower packs earlier; ties break by stable input order. */
  readonly priority: number
  readonly projectId?: string
}

export interface PackInput {
  /** The week's Monday as the `YYYY-MM-DD` UTC day key. */
  readonly weekStartDay: string
  readonly days: readonly {
    readonly day: string
    /** Free slots after meetings/🛡/absences/existing plan — the caller's `freeWindows`. */
    readonly windows: readonly { readonly startMin: number; readonly endMin: number }[]
    /** The per-day personal line — packing NEVER exceeds it (no stretch here). */
    readonly capacityLineMin: number
  }[]
  readonly items: readonly PackItem[]
}

export interface PackResult {
  readonly placements: readonly {
    readonly itemId: string
    readonly day: string
    readonly startMin: number
    readonly lenMin: number
  }[]
  /** Capacity-honest remainder — shown ("n passen diese Woche nicht"), never hidden. */
  readonly unplaced: readonly string[]
}

/** Splitting an item is allowed only at fragments of at least this many minutes. */
export const MIN_SPLIT_FRAGMENT_MIN = 30

type Placement = PackResult['placements'][number]

interface Segment {
  start: number
  end: number
}

interface DayState {
  readonly day: string
  segments: Segment[]
  capacityLeft: number
}

/** Sort + merge windows into disjoint free segments; inverted windows carry no time. */
function normalizeWindows(
  windows: readonly { readonly startMin: number; readonly endMin: number }[],
): Segment[] {
  const sorted = windows
    .filter(win => win.endMin > win.startMin)
    .map(win => ({ start: win.startMin, end: win.endMin }))
    .sort((a, b) => a.start - b.start)
  const merged: Segment[] = []
  for (const seg of sorted) {
    const last = merged[merged.length - 1]
    if (last && seg.start <= last.end) last.end = Math.max(last.end, seg.end)
    else merged.push({ ...seg })
  }
  return merged
}

/**
 * Try to place one whole item onto a cloned copy of the day states. Fragments are taken from
 * the front of each free segment, days in the given order — the earliest possible slots.
 * Returns the fragments plus the advanced states, or `null` when the item cannot be placed
 * completely (the caller keeps the untouched states — all-or-nothing).
 */
function tryPlaceWhole(
  days: readonly DayState[],
  itemId: string,
  estimateMin: number,
): { placements: Placement[]; days: DayState[] } | null {
  const cloned: DayState[] = days.map(d => ({
    day: d.day,
    segments: d.segments.map(s => ({ ...s })),
    capacityLeft: d.capacityLeft,
  }))
  const placements: Placement[] = []
  let remaining = estimateMin
  for (const dayState of cloned) {
    if (remaining === 0) break
    for (const seg of dayState.segments) {
      if (remaining === 0) break
      const avail = Math.min(seg.end - seg.start, dayState.capacityLeft)
      if (avail <= 0) continue
      let take: number
      if (avail >= remaining) {
        take = remaining // the final (or only) fragment
      } else {
        // A split fragment: it must reach the floor itself AND leave a rest that can still
        // reach the floor — otherwise this slot cannot lawfully host a fragment.
        take = Math.min(avail, remaining - MIN_SPLIT_FRAGMENT_MIN)
        if (take < MIN_SPLIT_FRAGMENT_MIN) continue
      }
      placements.push({ itemId, day: dayState.day, startMin: seg.start, lenMin: take })
      seg.start += take
      dayState.capacityLeft -= take
      remaining -= take
    }
  }
  return remaining === 0 ? { placements, days: cloned } : null
}

/** Pack the backlog into the week. Pure and deterministic — see the module contract above. */
export function packWeek(input: PackInput): PackResult {
  let dayStates: DayState[] = input.days.map(d => ({
    day: d.day,
    segments: normalizeWindows(d.windows),
    capacityLeft: Math.max(0, Math.floor(d.capacityLineMin)),
  }))

  // Priority order with the stable tie-break on input position.
  const ordered = input.items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.priority - b.item.priority || a.index - b.index)

  const placements: Placement[] = []
  const unplaced: string[] = []

  for (const { item } of ordered) {
    const estimateMin = Math.floor(item.estimateMin)
    if (estimateMin <= 0) {
      unplaced.push(item.id)
      continue
    }
    const attempt = tryPlaceWhole(dayStates, item.id, estimateMin)
    if (attempt === null) {
      unplaced.push(item.id) // all-or-nothing: nothing of this item was kept
    } else {
      placements.push(...attempt.placements)
      dayStates = attempt.days
    }
  }

  return { placements, unplaced }
}
