import Stripe from 'stripe'
import type { EntitlementEvent, EntitlementEventType } from '@mydevtime/domain'
import type { NormalizedEvent, PaymentProviderPort, RawWebhook } from '../port.js'

/**
 * The Stripe adapter (REQ-017, ADR-0006) — the single file the Stripe SDK lives
 * in (process skill §2.2). It verifies a webhook's signature and maps Stripe's
 * events into the provider-agnostic `EntitlementEvent`s the domain state machine
 * understands; `Stripe.*` types never leave this folder, and nothing upstream
 * (service, routes, clients) imports them.
 *
 * Entitlement state is driven **only** by `customer.subscription.*` events: they
 * carry the authoritative status, current period end, and cancel flag, so one
 * event type maps the whole lifecycle without the double-counting risk of also
 * reacting to `invoice.*`. The deterministic engine (#21) is idempotent and
 * order-independent, so redelivered/reordered webhooks converge.
 */
export interface StripeGatewayConfig {
  readonly secretKey: string
  readonly webhookSecret: string
}

function customerId(sub: Stripe.Subscription): string {
  return typeof sub.customer === 'string' ? sub.customer : sub.customer.id
}

/** Current period end in epoch-ms. Stripe (2025 API) carries it per item. */
function periodEndMs(sub: Stripe.Subscription): number | undefined {
  const end = sub.items.data[0]?.current_period_end
  return end === undefined ? undefined : end * 1000
}

/** Map a Stripe subscription's status (+ cancel flag) to an entitlement event type. */
function subscriptionEventType(sub: Stripe.Subscription): EntitlementEventType {
  switch (sub.status) {
    case 'active':
    case 'trialing':
      return sub.cancel_at_period_end ? 'canceled' : 'subscribed'
    case 'past_due':
      return 'payment_failed'
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
    case 'paused':
      return 'expired'
    case 'incomplete':
      return 'expired' // not yet paid → no entitlement
    default:
      return 'expired'
  }
}

/** Translate one Stripe event to an entitlement event, or null if we ignore it. */
export function stripeEventToEntitlement(event: Stripe.Event): NormalizedEvent | null {
  const effectiveAt = event.created * 1000
  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated'
  ) {
    const sub = event.data.object
    const type = subscriptionEventType(sub)
    const periodEnd = periodEndMs(sub)
    const base = { id: event.id, source: 'stripe' as const, type, effectiveAt }
    let eventOut: EntitlementEvent = base
    if (type === 'payment_failed' && periodEnd !== undefined)
      eventOut = { ...base, graceUntil: periodEnd }
    else if (type !== 'expired' && type !== 'payment_failed' && periodEnd !== undefined)
      eventOut = { ...base, periodEnd }
    return { accountRef: customerId(sub), event: eventOut }
  }
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    return {
      accountRef: customerId(sub),
      event: { id: event.id, source: 'stripe', type: 'expired', effectiveAt },
    }
  }
  return null
}

/**
 * The Stripe gateway: the webhook `normalize` (a `PaymentProviderPort`) plus the
 * outbound Checkout / Billing-portal / customer calls the routes need. Every
 * method that touches the Stripe network stays here so the SDK is confined to
 * this file; callers get plain strings back.
 */
export interface StripeGateway extends PaymentProviderPort {
  /** Create a Stripe customer for a workspace and return its id (`cus_…`). */
  createCustomer(input: { workspaceId: string; email?: string }): Promise<string>
  /** A Checkout session URL for the Pro subscription. `client_reference_id` = workspace. */
  createCheckoutSession(input: {
    customerId: string
    priceId: string
    workspaceId: string
    successUrl: string
    cancelUrl: string
  }): Promise<string>
  /** A Billing customer-portal URL for self-service (payment method, cancel, invoices). */
  createPortalSession(input: { customerId: string; returnUrl: string }): Promise<string>
}

export function createStripeGateway(cfg: StripeGatewayConfig): StripeGateway {
  const stripe = new Stripe(cfg.secretKey)
  return {
    source: 'stripe',
    normalize(raw: RawWebhook): NormalizedEvent[] {
      // Throws on an invalid/absent signature — the caller returns 400.
      const event = stripe.webhooks.constructEvent(raw.body, raw.signature, cfg.webhookSecret)
      const mapped = stripeEventToEntitlement(event)
      return mapped ? [mapped] : []
    },
    async createCustomer({ workspaceId, email }) {
      const customer = await stripe.customers.create({
        ...(email !== undefined ? { email } : {}),
        metadata: { workspaceId },
      })
      return customer.id
    },
    async createCheckoutSession({ customerId, priceId, workspaceId, successUrl, cancelUrl }) {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: workspaceId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        automatic_tax: { enabled: true },
      })
      if (!session.url) throw new Error('Stripe did not return a Checkout URL')
      return session.url
    },
    async createPortalSession({ customerId, returnUrl }) {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      })
      return session.url
    },
  }
}
