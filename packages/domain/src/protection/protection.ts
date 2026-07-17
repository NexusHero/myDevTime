import type { Instant } from '../tracking/time.js'

/**
 * Protection flag "🛡 Geschützt" (REQ-057, design v14 D14) — pure and deterministic
 * (ADR-0005). The flag lives on an **existing** entry (it is not a new type and not a
 * focus-mode system); its whole job is **communication, never time-tracking**:
 *
 * - While a protected block is active, the user's *own* nudges (Smart Reminder, task
 *   reminders, drift chips) and inbound requests are **held**, and Outlook reports "Busy".
 * - Afterwards the held items surface as **exactly one** digest ("Während Family: 2
 *   Anfragen, 1 Reminder") — nothing is lost, nothing is auto-dismissed.
 * - The timer and punch clock are **untouched**. At a protected block that starts while the
 *   user is punched in, the Island asks **once** ("Family beginnt — ausstempeln?") and
 *   **never auto-punches-out** (the punch clock is a record; the human decides).
 *
 * This module deliberately contains no time-tracking math — that is the point of D14: the
 * flag can only route communication, so it *cannot* alter a tracked minute.
 */

/** What can be held while protection is active. */
export type HeldKind = 'meeting_request' | 'task_reminder' | 'timer_nudge' | 'drift_chip'

export interface HeldItem {
  readonly kind: HeldKind
  /** When the notification would have fired (epoch-ms). */
  readonly atMs: Instant
  /** Optional short label for the digest line (e.g. a requester or ticket key). */
  readonly label?: string
}

export interface ProtectedBlock {
  readonly startMs: Instant
  /** Exclusive end (a notification exactly at `endMs` is already outside protection). */
  readonly endMs: Instant
}

export interface ProtectionDigest {
  /** Every held item, in input order — nothing dropped. */
  readonly items: readonly HeldItem[]
  /** Count per kind, present only for kinds that occurred. */
  readonly counts: Partial<Record<HeldKind, number>>
  readonly total: number
}

/** Whether an instant falls inside any protected block (half-open `[start, end)`). */
export function isProtectedAt(instant: Instant, blocks: readonly ProtectedBlock[]): boolean {
  return blocks.some(b => instant >= b.startMs && instant < b.endMs)
}

/**
 * Split notifications into those **held** (fired during protection) and those **delivered**
 * (everything else). Order within each group is preserved.
 */
export function partitionByProtection(
  items: readonly HeldItem[],
  blocks: readonly ProtectedBlock[],
): { readonly heldItems: readonly HeldItem[]; readonly delivered: readonly HeldItem[] } {
  const heldItems: HeldItem[] = []
  const delivered: HeldItem[] = []
  for (const item of items) {
    if (isProtectedAt(item.atMs, blocks)) heldItems.push(item)
    else delivered.push(item)
  }
  return { heldItems, delivered }
}

/**
 * Aggregate held items into **one** digest with per-kind counts. Building a single digest
 * from the whole set (rather than one per item) is exactly the "danach EIN Digest" rule.
 */
export function buildDigest(heldItems: readonly HeldItem[]): ProtectionDigest {
  const counts: Partial<Record<HeldKind, number>> = {}
  for (const item of heldItems) {
    counts[item.kind] = (counts[item.kind] ?? 0) + 1
  }
  return { items: [...heldItems], counts, total: heldItems.length }
}

/**
 * Whether the Island should raise its one-time transition prompt at a protected block's
 * start: only when the user is punched in and has not been asked for this transition yet.
 * There is deliberately no "auto-punch-out" path — the caller may only *prompt*.
 */
export function transitionPromptDue(state: {
  readonly punchedIn: boolean
  readonly alreadyPrompted: boolean
}): boolean {
  return state.punchedIn && !state.alreadyPrompted
}
