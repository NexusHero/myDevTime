import type { Instant } from '../tracking/time.js'
import {
  FREE,
  type Entitlement,
  type EntitlementEvent,
  type EntitlementSource,
  type EntitlementStatus,
} from './types.js'

/**
 * The entitlement state machine (REQ-016, ADR-0006). `deriveEntitlement` folds a
 * set of provider-agnostic events into the current account entitlement as of
 * `now`. It is:
 *
 * - **idempotent / replay-safe** — events are de-duplicated by `id`, so a
 *   redelivered webhook changes nothing;
 * - **order-independent** — events are sorted deterministically by
 *   `(effectiveAt, id)` before folding, so any delivery order yields the same
 *   result (the property the issue calls out);
 * - **pure** — no clock of its own; `now` is passed in.
 */

/** Tie-break order when two sources cover Pro to the exact same instant. Paid rails outrank promo; web billing (Stripe) is our canonical rail. */
const SOURCE_PRECEDENCE: readonly EntitlementSource[] = ['stripe', 'app_store', 'play', 'promo']

interface SourceState {
  status: 'active' | 'past_due' | 'canceled_at_period_end' | 'expired'
  periodEnd: Instant | null
  graceUntil: Instant | null
}

/** Fold one source's ordered events into its latest known subscription state. */
function foldSource(events: readonly EntitlementEvent[]): SourceState {
  const state: SourceState = { status: 'expired', periodEnd: null, graceUntil: null }
  for (const e of events) {
    switch (e.type) {
      case 'subscribed':
      case 'renewed':
      case 'promo_granted':
        state.status = 'active'
        if (e.periodEnd !== undefined) state.periodEnd = e.periodEnd
        break
      case 'recovered':
        state.status = 'active'
        if (e.periodEnd !== undefined) state.periodEnd = e.periodEnd
        break
      case 'payment_failed':
        state.status = 'past_due'
        if (e.graceUntil !== undefined) state.graceUntil = e.graceUntil
        break
      case 'canceled':
        state.status = 'canceled_at_period_end'
        if (e.periodEnd !== undefined) state.periodEnd = e.periodEnd
        break
      case 'expired':
      case 'revoked':
        state.status = 'expired'
        break
    }
  }
  return state
}

interface Coverage {
  readonly grantsPro: boolean
  /** The instant Pro coverage runs to; null means unbounded/unknown (outlasts any finite end). */
  readonly end: Instant | null
  readonly inGrace: boolean
  readonly status: EntitlementStatus
}

/** Resolve a source's folded state to whether it grants Pro as of `now`. */
function coverageAsOf(s: SourceState, now: Instant): Coverage {
  switch (s.status) {
    case 'active':
      if (s.periodEnd !== null && now >= s.periodEnd)
        return { grantsPro: false, end: s.periodEnd, inGrace: false, status: 'expired' }
      return { grantsPro: true, end: s.periodEnd, inGrace: false, status: 'active' }
    case 'canceled_at_period_end':
      if (s.periodEnd !== null && now >= s.periodEnd)
        return { grantsPro: false, end: s.periodEnd, inGrace: false, status: 'expired' }
      return { grantsPro: true, end: s.periodEnd, inGrace: false, status: 'canceled_at_period_end' }
    case 'past_due':
      if (s.graceUntil !== null && now >= s.graceUntil)
        return { grantsPro: false, end: s.graceUntil, inGrace: false, status: 'expired' }
      return { grantsPro: true, end: s.graceUntil, inGrace: true, status: 'past_due' }
    case 'expired':
      return { grantsPro: false, end: s.periodEnd, inGrace: false, status: 'expired' }
  }
}

/** null end (unbounded) sorts after every finite end. */
function endRank(end: Instant | null): number {
  return end ?? Number.POSITIVE_INFINITY
}

export function deriveEntitlement(events: readonly EntitlementEvent[], now: Instant): Entitlement {
  if (events.length === 0) return FREE

  // Idempotent: collapse duplicate event ids (last write for a given id wins,
  // but ids are immutable facts so any copy is equivalent).
  const byId = new Map<string, EntitlementEvent>()
  for (const e of events) byId.set(e.id, e)

  // Order-independent: one canonical order regardless of delivery order.
  const ordered = [...byId.values()].sort((a, b) =>
    a.effectiveAt !== b.effectiveAt ? a.effectiveAt - b.effectiveAt : a.id < b.id ? -1 : 1,
  )

  const perSource = new Map<EntitlementSource, EntitlementEvent[]>()
  for (const e of ordered) {
    const list = perSource.get(e.source)
    if (list) list.push(e)
    else perSource.set(e.source, [e])
  }

  let winner: { source: EntitlementSource; cov: Coverage } | null = null
  for (const [source, evs] of perSource) {
    const cov = coverageAsOf(foldSource(evs), now)
    if (!cov.grantsPro) continue
    if (
      winner === null ||
      endRank(cov.end) > endRank(winner.cov.end) ||
      (endRank(cov.end) === endRank(winner.cov.end) &&
        SOURCE_PRECEDENCE.indexOf(source) < SOURCE_PRECEDENCE.indexOf(winner.source))
    ) {
      winner = { source, cov }
    }
  }

  if (winner === null) {
    // Had records but none grant Pro now → lapsed, not never-subscribed.
    return { plan: 'free', status: 'expired', source: null, currentPeriodEnd: null, inGrace: false }
  }
  return {
    plan: 'pro',
    status: winner.cov.status,
    source: winner.source,
    currentPeriodEnd: winner.cov.end,
    inGrace: winner.cov.inGrace,
  }
}
