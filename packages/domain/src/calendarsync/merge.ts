import type { Instant } from '../tracking/time.js'

/**
 * Deterministic calendar-sync merge (REQ-064, design v17 §F6) — pure and side-effect-free
 * (ADR-0005). External calendars (Google, Apple) are volatile vendors reached through a narrow
 * port; whatever adapter fetches them, the events arrive here as plain `ExternalEvent`s and this
 * core decides, deterministically, what the sync *proposes*. It **never writes**: like every AI /
 * external source (ADR-0005), a merge yields a review queue of proposals the user confirms —
 * calendar events become **ghost** blocks to accept, an auto-capture candidate, never an
 * auto-booked entry. The import is keyed on the event `uid` so the same event is imported once and
 * a later time-change is an update, not a duplicate.
 */

/** An event as it comes from a provider (via the adapter) — only these neutral fields. */
export interface ExternalEvent {
  /** Stable provider id for the event; the merge key. */
  readonly uid: string
  readonly startMs: Instant
  /** Exclusive end. */
  readonly endMs: Instant
  readonly title: string
}

/** A local block already imported from a calendar — carries the `uid` it came from. */
export interface ImportedBlock {
  readonly uid: string
  readonly startMs: Instant
  readonly endMs: Instant
  readonly title: string
}

/** How an external event relates to what we already imported. */
export type MergeChange =
  // Never seen this uid → propose importing it as a ghost block to confirm.
  | { readonly kind: 'new'; readonly event: ExternalEvent }
  // Seen it, and its time or title moved → propose updating the imported block.
  | { readonly kind: 'changed'; readonly event: ExternalEvent; readonly from: ImportedBlock }

export interface MergeProposal {
  /** New + changed external events — every one a proposal, none auto-applied. */
  readonly changes: readonly MergeChange[]
  /** Imported blocks whose external event vanished — propose removing (still user-confirmed). */
  readonly orphaned: readonly ImportedBlock[]
  /** Unchanged events (already imported, identical) — no action. */
  readonly unchangedCount: number
}

function sameTiming(event: ExternalEvent, block: ImportedBlock): boolean {
  return (
    event.startMs === block.startMs && event.endMs === block.endMs && event.title === block.title
  )
}

/**
 * Diff a provider's current events against what we already imported. Returns a set of
 * **proposals** (new / changed / orphaned) — deterministic, keyed on `uid`, in stable input
 * order; nothing is written. Empty/inverted events (`end <= start`) are ignored (a provider quirk
 * should never create a zero-length ghost).
 */
export function mergeCalendar(
  external: readonly ExternalEvent[],
  imported: readonly ImportedBlock[],
): MergeProposal {
  const byUid = new Map<string, ImportedBlock>()
  for (const block of imported) byUid.set(block.uid, block)

  const changes: MergeChange[] = []
  const seen = new Set<string>()
  let unchangedCount = 0

  for (const event of external) {
    if (event.endMs <= event.startMs) continue
    seen.add(event.uid)
    const existing = byUid.get(event.uid)
    if (!existing) {
      changes.push({ kind: 'new', event })
    } else if (!sameTiming(event, existing)) {
      changes.push({ kind: 'changed', event, from: existing })
    } else {
      unchangedCount++
    }
  }

  const orphaned = imported.filter(block => !seen.has(block.uid))
  return { changes, orphaned, unchangedCount }
}
