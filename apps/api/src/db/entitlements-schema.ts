import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { workspaces } from './schema.js'

/**
 * Entitlement event log (REQ-016, ADR-0006/0008) — the durable, append-only
 * input to the deterministic state machine in `packages/domain/entitlements`.
 * Payment providers (Stripe #22, store IAP #23) normalize their webhooks into
 * these provider-agnostic rows; the account's current plan is *derived* from the
 * log on read (`deriveEntitlement`), never stored as mutable state, so there is
 * no cache to invalidate and any webhook replay/reorder converges.
 *
 * `(workspace_id, provider_event_id)` is unique — that is the idempotency key
 * that makes a re-delivered webhook a no-op. `workspace` is the account/isolation
 * root here; the service scopes every query by it.
 */
export const entitlementEvents = pgTable(
  'entitlement_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** The provider's own event id — the idempotency key within a workspace. */
    providerEventId: text('provider_event_id').notNull(),
    /** 'stripe' | 'app_store' | 'play' | 'promo'. */
    source: text('source').notNull(),
    /** Provider-agnostic event type (see the domain `EntitlementEventType`). */
    type: text('type').notNull(),
    /** When the fact takes effect — the deterministic ordering key. */
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    /** Current period end for subscribe/renew/cancel/promo. */
    periodEnd: timestamp('period_end', { withTimezone: true }),
    /** Dunning grace end for a payment failure. */
    graceUntil: timestamp('grace_until', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [unique('entitlement_events_ws_provider_uq').on(t.workspaceId, t.providerEventId)],
)

/**
 * Maps a workspace to its provider-side account id (e.g. a Stripe customer id),
 * so a webhook that carries only the customer id can be routed back to the right
 * workspace, and so checkout re-uses the same customer (REQ-017, #22). One
 * account per (workspace, provider); the (provider, customer) pair is unique too,
 * which is the reverse lookup the webhook uses.
 */
export const billingCustomers = pgTable(
  'billing_customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** 'stripe' | 'app_store' | 'play'. */
    provider: text('provider').notNull(),
    /** The provider-side account id (Stripe `cus_…`). */
    customerId: text('customer_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    unique('billing_customers_ws_provider_uq').on(t.workspaceId, t.provider),
    unique('billing_customers_provider_customer_uq').on(t.provider, t.customerId),
  ],
)
