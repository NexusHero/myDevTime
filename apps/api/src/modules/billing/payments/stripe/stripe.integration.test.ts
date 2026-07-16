import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { createDb } from '../../../../db/client.js'
import { user } from '../../../../db/auth-schema.js'
import { workspaces } from '../../../../db/schema.js'
import { resolveWorkspaceId } from '../../../../core/workspace.js'
import { getEntitlement } from '../../entitlements-service.js'
import * as credits from '../../credits-service.js'
import { creditEntries } from '../../../../db/schema.js'
import { createStripeGateway } from './gateway.js'
import * as stripeSvc from './service.js'

/**
 * The Stripe webhook path against a REAL Postgres (REQ-017, #22): a signed
 * subscription event routes to its workspace via the customer link and lands in
 * the entitlement log, so the plan derives to Pro. No Stripe network — signing
 * and verification are local crypto. Skips without DATABASE_URL; CI provides it.
 */
const databaseUrl = process.env.DATABASE_URL
const SECRET = 'whsec_int_testsecret'

describe.skipIf(!databaseUrl)('stripe webhook (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const gateway = createStripeGateway({ secretKey: 'sk_test_x', webhookSecret: SECRET })
  const stripe = new Stripe('sk_test_x')
  const idA = 'itest-stripe-a'
  let wsA = ''

  const T = 1_700_000_000
  const PERIOD_END = 1_702_592_000

  function signedSub(
    evtId: string,
    customer: string,
    overrides: Record<string, unknown> = {},
  ): {
    body: string
    signature: string
  } {
    const body = JSON.stringify({
      id: evtId,
      object: 'event',
      type: 'customer.subscription.created',
      created: T,
      data: {
        object: {
          id: 'sub_int',
          object: 'subscription',
          customer,
          status: 'active',
          cancel_at_period_end: false,
          items: {
            object: 'list',
            data: [{ id: 'si_1', object: 'subscription_item', current_period_end: PERIOD_END }],
          },
          ...overrides,
        },
      },
    })
    const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET })
    return { body, signature }
  }

  beforeAll(async () => {
    await db.delete(user).where(eq(user.id, idA))
    await db
      .insert(user)
      .values({ id: idA, name: idA, email: 'stripe-a@itest.local', emailVerified: true })
    wsA = await resolveWorkspaceId(db, idA, 'A')
    await stripeSvc.linkCustomer(db, wsA, 'cus_int_a')
  })

  afterAll(async () => {
    await db.delete(creditEntries).where(eq(creditEntries.workspaceId, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(user).where(eq(user.id, idA))
    await handle.close()
  })

  it('LinkCustomer_RoundTrips', async () => {
    expect(await stripeSvc.getCustomerId(db, wsA)).toBe('cus_int_a')
  })

  it('SignedSubscription_RecordsAndDerivesPro', async () => {
    const res = await stripeSvc.handleWebhook(db, gateway, signedSub('evt_int_1', 'cus_int_a'))
    expect(res).toEqual({ recorded: 1, skipped: 0 })
    const view = await getEntitlement(db, wsA, new Date((T + 100) * 1000))
    expect(view).toMatchObject({ plan: 'pro', status: 'active', source: 'stripe' })
  })

  it('Redelivery_IsIdempotent', async () => {
    // Same event id again → recorded again returns 1 (normalize), but the log
    // dedupes on (workspace, providerEventId): still exactly one row → still Pro.
    await stripeSvc.handleWebhook(db, gateway, signedSub('evt_int_1', 'cus_int_a'))
    const view = await getEntitlement(db, wsA, new Date((T + 100) * 1000))
    expect(view.plan).toBe('pro')
  })

  it('MonthlyAllowance_GrantedOncePerEvent_DespiteRedelivery', async () => {
    // evt_int_1 was delivered twice (created + redelivery); the allowance is keyed on the
    // event id, so exactly one 500-credit grant landed — a redelivered webhook can't double it.
    expect(await credits.balanceFor(db, wsA)).toBe(500)
  })

  it('MonthlyAllowance_GrantsAgainForANewPeriodEvent', async () => {
    // A fresh event id (a renewal) is a new period → another 500-credit allowance.
    await stripeSvc.handleWebhook(db, gateway, signedSub('evt_int_renew', 'cus_int_a'))
    expect(await credits.balanceFor(db, wsA)).toBe(1000)
  })

  it('UnknownCustomer_IsSkipped', async () => {
    const res = await stripeSvc.handleWebhook(db, gateway, signedSub('evt_int_2', 'cus_unknown'))
    expect(res).toEqual({ recorded: 0, skipped: 1 })
  })

  it('BadSignature_Throws', async () => {
    const { body } = signedSub('evt_int_3', 'cus_int_a')
    await expect(
      stripeSvc.handleWebhook(db, gateway, { body, signature: 't=1,v1=bad' }),
    ).rejects.toThrow()
  })
})
