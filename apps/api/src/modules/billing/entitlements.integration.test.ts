import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { workspaces, entitlementEvents } from '../../db/schema.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import * as ent from './entitlements-service.js'

/**
 * The entitlement service against a REAL Postgres (SKILL §3.3, REQ-016): the
 * event log persists, the plan derives on read across the lifecycle, redelivery
 * is idempotent, and entitlements are workspace-isolated. Skips without
 * DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('entitlements (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-ent-a'
  const idB = 'itest-ent-b'
  let wsA = ''
  let wsB = ''
  const T = new Date('2026-06-01T00:00:00Z')
  const periodEnd = new Date('2026-07-01T00:00:00Z')

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'ent-a@itest.local'],
      [idB, 'ent-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  it('DefaultsToFree_WithNoEvents', async () => {
    const view = await ent.getEntitlement(db, wsA, T)
    expect(view.plan).toBe('free')
    expect(view.features).toEqual(['basic_tracking'])
    expect(await ent.checkFeature(db, wsA, 'ai_proposals', T)).toBe(false)
  })

  it('SubscribedEvent_DerivesActiveProAndUnlocksFeatures', async () => {
    await ent.recordEvent(db, wsA, {
      providerEventId: 'stripe_evt_1',
      source: 'stripe',
      type: 'subscribed',
      effectiveAt: T,
      periodEnd,
    })
    const view = await ent.getEntitlement(db, wsA, new Date('2026-06-15T00:00:00Z'))
    expect(view).toMatchObject({ plan: 'pro', status: 'active', source: 'stripe' })
    expect(view.currentPeriodEnd).toBe(periodEnd.getTime())
    expect(await ent.checkFeature(db, wsA, 'ai_proposals', new Date('2026-06-15T00:00:00Z'))).toBe(
      true,
    )
  })

  it('RedeliveredWebhook_IsIdempotent', async () => {
    const first = await ent.recordEvent(db, wsA, {
      providerEventId: 'stripe_evt_1', // same id as above
      source: 'stripe',
      type: 'subscribed',
      effectiveAt: T,
      periodEnd,
    })
    expect(first.recorded).toBe(false) // already present → no-op
    const rows = await db
      .select()
      .from(entitlementEvents)
      .where(eq(entitlementEvents.workspaceId, wsA))
    expect(rows.filter(r => r.providerEventId === 'stripe_evt_1')).toHaveLength(1)
  })

  it('AfterPeriodEnd_LapsesToFree', async () => {
    const view = await ent.getEntitlement(db, wsA, new Date('2026-08-01T00:00:00Z'))
    expect(view.plan).toBe('free')
    expect(view.status).toBe('expired')
  })

  it('IsolatesEntitlementsByWorkspace', async () => {
    // wsA is (was) Pro; wsB has no events → free. No leakage.
    const viewB = await ent.getEntitlement(db, wsB, new Date('2026-06-15T00:00:00Z'))
    expect(viewB.plan).toBe('free')
  })
})
