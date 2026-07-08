import type { Instant } from '../tracking/time.js'

/**
 * The domain model of monetization (REQ-016, ADR-0006 as amended by ADR-0008) —
 * pure and deterministic (ADR-0005). This is the single source of truth for
 * "what plan does an account have", built **before** any payment provider so
 * Stripe (#22) and the store IAPs (#23) become pure `PaymentProviderPort`
 * adapters that only translate their webhooks into the provider-agnostic
 * `EntitlementEvent`s defined here.
 *
 * AI usage is NOT metered here: the AI-credit ledger (#34, REQ-027) composes on
 * top, reading `plan` and `currentPeriodEnd` for its monthly allowance rather
 * than duplicating period logic.
 */

/** The gate every feature check reduces to. Free is the default for any account. */
export type Plan = 'free' | 'pro'

/** Where a paid entitlement came from. Promo is an internal grant (no payment). */
export type EntitlementSource = 'stripe' | 'app_store' | 'play' | 'promo'

/**
 * The lifecycle status surfaced to clients:
 * - `free` — never held Pro (no record → free, never an error).
 * - `active` — Pro, renewing.
 * - `past_due` — Pro, a payment failed; still entitled during the dunning grace.
 * - `canceled_at_period_end` — Pro until `currentPeriodEnd`, then lapses.
 * - `expired` — held Pro, now lapsed (back to free capabilities).
 */
export type EntitlementStatus =
  'free' | 'active' | 'past_due' | 'canceled_at_period_end' | 'expired'

/**
 * A provider-agnostic fact about one source's subscription, normalized from a
 * webhook/notification. Events are the input to the state machine; the machine
 * is replay-safe and order-independent (dedup by `id`, deterministic sort by
 * `effectiveAt`), so redelivered or reordered webhooks converge to one result.
 */
export type EntitlementEventType =
  | 'subscribed' // a paid subscription started or was re-started
  | 'renewed' // the period was extended
  | 'payment_failed' // entered dunning; `graceUntil` bounds continued access
  | 'recovered' // payment recovered → active again
  | 'canceled' // will not renew; entitled until `periodEnd`
  | 'expired' // the period ended without renewal → lapsed
  | 'revoked' // immediate loss (refund/chargeback)
  | 'promo_granted' // internal Pro grant until `periodEnd`

export interface EntitlementEvent {
  /** Provider event id — the idempotency/dedup key. */
  readonly id: string
  readonly source: EntitlementSource
  readonly type: EntitlementEventType
  /** When the fact takes effect (epoch-ms) — the deterministic ordering key. */
  readonly effectiveAt: Instant
  /** Current period end for subscribe/renew/cancel/promo (epoch-ms). */
  readonly periodEnd?: Instant
  /** Dunning grace end for `payment_failed` (epoch-ms). */
  readonly graceUntil?: Instant
}

/** The derived, account-level entitlement — what feature gates read. */
export interface Entitlement {
  readonly plan: Plan
  readonly status: EntitlementStatus
  /** The source backing an active Pro, or null for free. */
  readonly source: EntitlementSource | null
  /** End of the current Pro coverage (epoch-ms), or null for free/unbounded. */
  readonly currentPeriodEnd: Instant | null
  /** True while Pro is retained only by the dunning grace (`past_due`). */
  readonly inGrace: boolean
}

/** The default entitlement: absence of any record is `free`, never an error. */
export const FREE: Entitlement = {
  plan: 'free',
  status: 'free',
  source: null,
  currentPeriodEnd: null,
  inGrace: false,
}
