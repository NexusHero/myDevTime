import type { Instant } from '../tracking/time.js'

/**
 * Partner-light Free/Busy projection (REQ-064, design v17 §F6) — pure and deterministic
 * (ADR-0005). Family/partner sharing is **one link, free to view, calendar + requests only**:
 * the invitee sees *when* the owner is busy so they can plan around it and send requests, but
 * **never what** — no title, no project, no note, no client ever crosses the boundary.
 *
 * Isolation is by **construction**, not by filtering: the only shape a viewer can receive is
 * `FreeBusySlot`, and that type has no field that could carry a title. `redactBlock` is the one
 * choke point that turns a private `OwnerBlock` into a `FreeBusySlot`, discarding every private
 * field; nothing downstream can re-introduce detail because the detail is gone from the type.
 * A 🛡 protected block (D14) is still just "busy" here — protection already means "Busy to the
 * outside", so it needs no special case and leaks nothing extra.
 */

/** An owner's real calendar block — carries private detail that must never be shared. */
export interface OwnerBlock {
  readonly startMs: Instant
  /** Exclusive end. */
  readonly endMs: Instant
  /** Private — the block's title/label. Never exposed. */
  readonly title?: string
  /** Private — the project it belongs to. Never exposed. */
  readonly projectId?: string
  /** Private — free-text note. Never exposed. */
  readonly note?: string
  /** A 🛡 protected block (D14). Still only "busy" to a viewer; kept for the owner's own use. */
  readonly protectedFlag?: boolean
}

/**
 * The **only** shape a partner-light viewer ever receives. It has no title/project/note field,
 * so leaking private detail is not a rule we enforce — it is unrepresentable. `state` is always
 * `'busy'`; free time is the complement (the gaps), never a positive record of anything.
 */
export interface FreeBusySlot {
  readonly startMs: Instant
  /** Exclusive end. */
  readonly endMs: Instant
  readonly state: 'busy'
}

/** A half-open window `[startMs, endMs)` the viewer is asking about. */
export interface Window {
  readonly startMs: Instant
  readonly endMs: Instant
}

/**
 * The single choke point: an owner block → a bare busy slot, discarding every private field.
 * Everything the viewer can ever see passes through here, so no private detail survives.
 */
function redactBlock(block: OwnerBlock): FreeBusySlot {
  return { startMs: block.startMs, endMs: block.endMs, state: 'busy' }
}

/**
 * Project owner blocks to coalesced busy slots. Blocks are redacted first (detail gone), then
 * sorted and merged so overlapping or touching intervals become one — the viewer sees an
 * unbroken busy span, never a pattern of back-to-back meeting boundaries. Empty/inverted blocks
 * (`end <= start`) are dropped.
 */
export function toFreeBusy(blocks: readonly OwnerBlock[]): readonly FreeBusySlot[] {
  const slots = blocks
    .filter(b => b.endMs > b.startMs)
    .map(redactBlock)
    .sort((a, b) => a.startMs - b.startMs)

  const merged: FreeBusySlot[] = []
  for (const slot of slots) {
    const last = merged[merged.length - 1]
    // Touching (`start === last.end`) coalesces too: no zero-length gap is worth exposing.
    if (last && slot.startMs <= last.endMs) {
      if (slot.endMs > last.endMs) {
        merged[merged.length - 1] = { startMs: last.startMs, endMs: slot.endMs, state: 'busy' }
      }
      // else fully contained — nothing to add.
    } else {
      merged.push(slot)
    }
  }
  return merged
}

/**
 * The free gaps inside a window — the complement of the busy slots, clipped to `[start, end)`.
 * This is what the "when are you free" request flow reads: it never sees a busy block's detail,
 * only the openings between them. Returns `[]` for an empty/inverted window.
 */
export function freeGaps(blocks: readonly OwnerBlock[], window: Window): readonly Window[] {
  if (window.endMs <= window.startMs) return []
  const busy = toFreeBusy(blocks)
  const gaps: Window[] = []
  let cursor = window.startMs
  for (const slot of busy) {
    if (slot.endMs <= window.startMs || slot.startMs >= window.endMs) continue // outside window
    const busyStart = Math.max(slot.startMs, window.startMs)
    if (busyStart > cursor) gaps.push({ startMs: cursor, endMs: busyStart })
    cursor = Math.max(cursor, Math.min(slot.endMs, window.endMs))
  }
  if (cursor < window.endMs) gaps.push({ startMs: cursor, endMs: window.endMs })
  return gaps
}
