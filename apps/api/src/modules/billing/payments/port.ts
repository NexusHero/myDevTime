import type { EntitlementEvent, EntitlementSource } from '@mydevtime/domain'

/**
 * The one narrow interface every payment provider implements (ADR-0006, process
 * skill §2.2). Stripe (#22), StoreKit and Play Billing (#23) each get a single
 * adapter file that verifies and translates their raw webhook into the
 * provider-agnostic `EntitlementEvent`s the domain state machine understands —
 * vendor SDK types never leave that adapter, and nothing upstream (the service,
 * the routes, the clients) imports them.
 *
 * No concrete adapter ships in this phase: the entitlement service and its event
 * log are built first (#21) so the providers become pure plug-ins. The `promo`
 * source is served by the internal grant path, not a webhook, so it needs no
 * provider here.
 */

/** A verified provider webhook, reduced to what the port needs. */
export interface RawWebhook {
  /** Raw request body, for signature verification inside the adapter. */
  readonly body: string
  /** Provider signature header(s), verified by the adapter before trusting `body`. */
  readonly signature: string
}

/**
 * The account reference a webhook carries (e.g. a Stripe customer id). The
 * adapter yields this so the service can map it to a workspace via a stored
 * link; the mapping table lands with the first real provider (#22/#23).
 */
export interface NormalizedEvent {
  /** Provider-side account/customer id this event concerns. */
  readonly accountRef: string
  /** The provider-agnostic event (its `id` is the provider event id). */
  readonly event: EntitlementEvent
}

export interface PaymentProviderPort {
  readonly source: EntitlementSource
  /**
   * Verify `raw` (signature/authenticity) and normalize it into zero or more
   * provider-agnostic events. Must be pure w.r.t. the input and **idempotent by
   * event id** so redelivery is safe. Throws if the signature is invalid.
   */
  normalize(raw: RawWebhook): NormalizedEvent[]
}
