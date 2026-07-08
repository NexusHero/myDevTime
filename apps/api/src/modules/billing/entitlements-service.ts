import { eq } from 'drizzle-orm'
import {
  can,
  deriveEntitlement,
  featuresFor,
  type Entitlement,
  type EntitlementEvent,
  type EntitlementEventType,
  type EntitlementSource,
  type Feature,
} from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { entitlementEvents } from '../../db/schema.js'
import { ValidationError } from '../../errors.js'

/**
 * The entitlement service (REQ-016) — the impure edge over the deterministic
 * state machine in `packages/domain/entitlements`. It owns the append-only event
 * log and *derives* the current plan on read; it never stores mutable plan state.
 * Every function takes `workspaceId` non-optionally and scopes every query by it
 * (isolation by construction) — `workspace` is the account/isolation root here.
 *
 * This is the seam the payment adapters (Stripe #22, store IAP #23) call after
 * they normalize a webhook via `PaymentProviderPort`; recording is idempotent by
 * `(workspace, providerEventId)`, so a re-delivered webhook is a no-op.
 */

const SOURCES: readonly EntitlementSource[] = ['stripe', 'app_store', 'play', 'promo']
const TYPES: readonly EntitlementEventType[] = [
  'subscribed',
  'renewed',
  'payment_failed',
  'recovered',
  'canceled',
  'expired',
  'revoked',
  'promo_granted',
]

export interface RecordEventInput {
  providerEventId: string
  source: EntitlementSource
  type: EntitlementEventType
  effectiveAt: Date
  periodEnd?: Date | null | undefined
  graceUntil?: Date | null | undefined
}

/**
 * Append a provider-agnostic event to the log. Idempotent: a duplicate
 * `(workspace, providerEventId)` is ignored (`onConflictDoNothing`), so redelivery
 * never double-counts. Returns whether the row was newly recorded.
 */
export async function recordEvent(
  db: Db,
  workspaceId: string,
  input: RecordEventInput,
): Promise<{ recorded: boolean }> {
  if (!SOURCES.includes(input.source)) throw new ValidationError('invalid entitlement source')
  if (!TYPES.includes(input.type)) throw new ValidationError('invalid entitlement event type')
  const inserted = await db
    .insert(entitlementEvents)
    .values({
      workspaceId,
      providerEventId: input.providerEventId,
      source: input.source,
      type: input.type,
      effectiveAt: input.effectiveAt,
      periodEnd: input.periodEnd ?? null,
      graceUntil: input.graceUntil ?? null,
    })
    .onConflictDoNothing({
      target: [entitlementEvents.workspaceId, entitlementEvents.providerEventId],
    })
    .returning({ id: entitlementEvents.id })
  return { recorded: inserted.length > 0 }
}

/** Load a workspace's event log, mapped into domain events (epoch-ms instants). */
async function loadEvents(db: Db, workspaceId: string): Promise<EntitlementEvent[]> {
  const rows = await db
    .select()
    .from(entitlementEvents)
    .where(eq(entitlementEvents.workspaceId, workspaceId))
  return rows.map(r => {
    const base = {
      id: r.providerEventId,
      source: r.source as EntitlementSource,
      type: r.type as EntitlementEventType,
      effectiveAt: r.effectiveAt.getTime(),
    }
    const event: EntitlementEvent = {
      ...base,
      ...(r.periodEnd ? { periodEnd: r.periodEnd.getTime() } : {}),
      ...(r.graceUntil ? { graceUntil: r.graceUntil.getTime() } : {}),
    }
    return event
  })
}

export interface EntitlementView extends Entitlement {
  readonly features: readonly Feature[]
}

/** The derived entitlement for a workspace as of `now`, plus its unlocked features. */
export async function getEntitlement(
  db: Db,
  workspaceId: string,
  now: Date,
): Promise<EntitlementView> {
  const ent = deriveEntitlement(await loadEvents(db, workspaceId), now.getTime())
  return { ...ent, features: featuresFor(ent.plan) }
}

/** Server-side feature gate — the single question every gated path asks. */
export async function checkFeature(
  db: Db,
  workspaceId: string,
  feature: Feature,
  now: Date,
): Promise<boolean> {
  const ent = deriveEntitlement(await loadEvents(db, workspaceId), now.getTime())
  return can(ent, feature)
}
