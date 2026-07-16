import { and, eq } from 'drizzle-orm'
import type { EntitlementEventType } from '@mydevtime/domain'
import type { Db } from '../../../../db/client.js'
import { billingCustomers } from '../../../../db/schema.js'
import * as entitlements from '../../entitlements-service.js'
import * as credits from '../../credits-service.js'
import type { PaymentProviderPort, RawWebhook } from '../port.js'
import type { StripeGateway } from './gateway.js'

/**
 * The impure edge that connects the Stripe gateway to persistence (REQ-017, #22):
 * the workspace↔customer mapping (so a webhook carrying only a customer id routes
 * back to a workspace, and checkout reuses the same customer), and the webhook
 * handler that records the adapter's events into the entitlement log. Idempotency
 * and ordering are guaranteed downstream by #21.
 */
const PROVIDER = 'stripe'

/** Event types that start or renew a paid period — each earns the plan's monthly allowance. */
const PERIOD_START_TYPES: readonly EntitlementEventType[] = ['subscribed', 'renewed', 'recovered']

export async function getCustomerId(db: Db, workspaceId: string): Promise<string | null> {
  const rows = await db
    .select({ customerId: billingCustomers.customerId })
    .from(billingCustomers)
    .where(
      and(eq(billingCustomers.workspaceId, workspaceId), eq(billingCustomers.provider, PROVIDER)),
    )
  return rows[0]?.customerId ?? null
}

export async function linkCustomer(db: Db, workspaceId: string, customerId: string): Promise<void> {
  await db
    .insert(billingCustomers)
    .values({ workspaceId, provider: PROVIDER, customerId })
    .onConflictDoNothing({ target: [billingCustomers.workspaceId, billingCustomers.provider] })
}

async function workspaceForCustomer(db: Db, customerId: string): Promise<string | null> {
  const rows = await db
    .select({ workspaceId: billingCustomers.workspaceId })
    .from(billingCustomers)
    .where(
      and(eq(billingCustomers.provider, PROVIDER), eq(billingCustomers.customerId, customerId)),
    )
  return rows[0]?.workspaceId ?? null
}

/**
 * Verify + record a Stripe webhook. `normalize` throws on a bad signature (the
 * route turns that into a 400). Each event is routed to its workspace by customer
 * id and appended to the entitlement log; an event for an unknown customer is
 * skipped (not an error — it may predate the mapping or belong to another env).
 */
export async function handleWebhook(
  db: Db,
  gateway: PaymentProviderPort,
  raw: RawWebhook,
): Promise<{ recorded: number; skipped: number }> {
  const events = gateway.normalize(raw)
  let recorded = 0
  let skipped = 0
  for (const { accountRef, event } of events) {
    const workspaceId = await workspaceForCustomer(db, accountRef)
    if (!workspaceId) {
      skipped++
      continue
    }
    await entitlements.recordEvent(db, workspaceId, {
      providerEventId: event.id,
      source: event.source,
      type: event.type,
      effectiveAt: new Date(event.effectiveAt),
      periodEnd: event.periodEnd === undefined ? null : new Date(event.periodEnd),
      graceUntil: event.graceUntil === undefined ? null : new Date(event.graceUntil),
    })
    // A paid period starting/renewing earns the plan's monthly credit allowance (#148).
    // Idempotent per event id, so webhook redelivery never double-grants; a Stripe paid
    // subscription confers `pro`.
    if (PERIOD_START_TYPES.includes(event.type)) {
      await credits.grantMonthlyAllowance(db, workspaceId, {
        plan: 'pro',
        source: PROVIDER,
        periodRef: event.id,
      })
    }
    recorded++
  }
  return { recorded, skipped }
}

export interface CheckoutConfig {
  readonly priceId: string
  readonly baseUrl: string
}

/** Ensure the workspace has a Stripe customer, then return a Checkout URL. */
export async function startCheckout(
  db: Db,
  gateway: StripeGateway,
  cfg: CheckoutConfig,
  workspaceId: string,
  email?: string,
): Promise<string> {
  let customerId = await getCustomerId(db, workspaceId)
  if (!customerId) {
    customerId = await gateway.createCustomer(
      email !== undefined ? { workspaceId, email } : { workspaceId },
    )
    await linkCustomer(db, workspaceId, customerId)
    // Re-read in case a concurrent request linked first (unique constraint).
    customerId = (await getCustomerId(db, workspaceId)) ?? customerId
  }
  return gateway.createCheckoutSession({
    customerId,
    priceId: cfg.priceId,
    workspaceId,
    successUrl: `${cfg.baseUrl}/billing/success`,
    cancelUrl: `${cfg.baseUrl}/billing/cancel`,
  })
}

/** A Billing portal URL for a workspace that already has a Stripe customer. */
export async function startPortal(
  db: Db,
  gateway: StripeGateway,
  baseUrl: string,
  workspaceId: string,
): Promise<string | null> {
  const customerId = await getCustomerId(db, workspaceId)
  if (!customerId) return null
  return gateway.createPortalSession({ customerId, returnUrl: `${baseUrl}/billing` })
}
