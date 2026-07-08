import { describe, expect, it } from 'vitest'
import Stripe from 'stripe'
import { deriveEntitlement } from '@mydevtime/domain'
import { createStripeGateway } from './gateway.js'

/**
 * Stripe adapter (REQ-017). Webhook fixtures are signed with Stripe's own test
 * helper and pushed through the real `constructEvent` verification, so these
 * assert signature handling + the lifecycle mapping without any network. The
 * final test shows the adapter's output composing with the deterministic engine.
 */
const SECRET = 'whsec_testsecret'
const gw = createStripeGateway({ secretKey: 'sk_test_x', webhookSecret: SECRET })
const stripe = new Stripe('sk_test_x')

const T = 1_700_000_000 // event.created, epoch seconds
const PERIOD_END = 1_702_592_000

function sub(
  overrides: Record<string, unknown> = {},
  periodEnd = PERIOD_END,
): Record<string, unknown> {
  return {
    id: 'sub_1',
    object: 'subscription',
    customer: 'cus_123',
    status: 'active',
    cancel_at_period_end: false,
    // Stripe's 2025 API carries the billing period per subscription item.
    items: {
      object: 'list',
      data: [{ id: 'si_1', object: 'subscription_item', current_period_end: periodEnd }],
    },
    ...overrides,
  }
}

function signed(evt: Record<string, unknown>): { body: string; signature: string } {
  const body = JSON.stringify(evt)
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET })
  return { body, signature }
}

function event(
  id: string,
  type: string,
  object: Record<string, unknown>,
  created = T,
): Record<string, unknown> {
  return { id, object: 'event', type, created, data: { object } }
}

describe('Stripe webhook → entitlement mapping', () => {
  it('SubscriptionCreated_Active_MapsToSubscribedWithPeriodEnd', () => {
    const out = gw.normalize(signed(event('evt_1', 'customer.subscription.created', sub())))
    expect(out).toEqual([
      {
        accountRef: 'cus_123',
        event: {
          id: 'evt_1',
          source: 'stripe',
          type: 'subscribed',
          effectiveAt: T * 1000,
          periodEnd: PERIOD_END * 1000,
        },
      },
    ])
  })

  it('PastDue_MapsToPaymentFailedWithGrace', () => {
    const out = gw.normalize(
      signed(event('evt_2', 'customer.subscription.updated', sub({ status: 'past_due' }))),
    )
    expect(out[0]?.event).toMatchObject({ type: 'payment_failed', graceUntil: PERIOD_END * 1000 })
    expect(out[0]?.event).not.toHaveProperty('periodEnd')
  })

  it('CancelAtPeriodEnd_MapsToCanceled', () => {
    const out = gw.normalize(
      signed(event('evt_3', 'customer.subscription.updated', sub({ cancel_at_period_end: true }))),
    )
    expect(out[0]?.event).toMatchObject({ type: 'canceled', periodEnd: PERIOD_END * 1000 })
  })

  it('SubscriptionDeleted_MapsToExpired', () => {
    const out = gw.normalize(
      signed(event('evt_4', 'customer.subscription.deleted', sub({ status: 'canceled' }))),
    )
    expect(out[0]?.event).toMatchObject({ type: 'expired' })
    expect(out[0]?.accountRef).toBe('cus_123')
  })

  it('IgnoredEventType_ReturnsEmpty', () => {
    const out = gw.normalize(
      signed(event('evt_5', 'invoice.paid', { id: 'in_1', object: 'invoice' })),
    )
    expect(out).toEqual([])
  })

  it('InvalidSignature_Throws', () => {
    const body = JSON.stringify(event('evt_6', 'customer.subscription.created', sub()))
    expect(() => gw.normalize({ body, signature: 't=1,v1=deadbeef' })).toThrow()
  })

  it('EventId_IsTheIdempotencyKey', () => {
    // Same Stripe event id → same entitlement event id, so #21's dedupe is a no-op on redelivery.
    const raw = signed(event('evt_dup', 'customer.subscription.created', sub()))
    expect(gw.normalize(raw)[0]?.event.id).toBe('evt_dup')
  })

  it('AdapterOutput_ComposesWithTheDeterministicEngine', () => {
    const events = [
      gw.normalize(signed(event('e1', 'customer.subscription.created', sub(), T)))[0]!.event,
      gw.normalize(
        signed(event('e2', 'customer.subscription.updated', sub({ status: 'past_due' }), T + 100)),
      )[0]!.event,
      gw.normalize(
        signed(event('e3', 'customer.subscription.updated', sub({}, PERIOD_END + 1000), T + 200)),
      )[0]!.event,
    ]
    const ent = deriveEntitlement(events, (T + 300) * 1000)
    expect(ent).toMatchObject({ plan: 'pro', status: 'active', source: 'stripe' })
  })
})
