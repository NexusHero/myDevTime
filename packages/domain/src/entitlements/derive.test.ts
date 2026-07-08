import { describe, expect, it } from 'vitest'
import { deriveEntitlement } from './derive.js'
import { FREE, type EntitlementEvent } from './types.js'

/**
 * State-machine coverage (REQ-016). Times are fixed epoch-ms; `now` is always
 * passed in, never read from a clock.
 */
const T = 1_700_000_000_000
const DAY = 86_400_000
const MONTH = 30 * DAY
const periodEnd = T + MONTH
const now = T + DAY // one day into the period

let seq = 0
const ev = (partial: Omit<EntitlementEvent, 'id'> & { id?: string }): EntitlementEvent => ({
  id: partial.id ?? `e${String(seq++)}`,
  ...partial,
})

describe('entitlement state machine', () => {
  it('NoEvents_IsFreeByDefault', () => {
    expect(deriveEntitlement([], now)).toEqual(FREE)
  })

  it('Subscribed_IsActiveProUntilPeriodEnd', () => {
    const e = [ev({ source: 'stripe', type: 'subscribed', effectiveAt: T, periodEnd })]
    const ent = deriveEntitlement(e, now)
    expect(ent).toMatchObject({
      plan: 'pro',
      status: 'active',
      source: 'stripe',
      currentPeriodEnd: periodEnd,
      inGrace: false,
    })
  })

  it('Active_AfterPeriodEndWithoutRenewal_LapsesToFree', () => {
    const e = [ev({ source: 'stripe', type: 'subscribed', effectiveAt: T, periodEnd })]
    const ent = deriveEntitlement(e, periodEnd + DAY)
    expect(ent.plan).toBe('free')
    expect(ent.status).toBe('expired')
  })

  it('Renewed_ExtendsThePeriod', () => {
    const e = [
      ev({ source: 'stripe', type: 'subscribed', effectiveAt: T, periodEnd }),
      ev({
        source: 'stripe',
        type: 'renewed',
        effectiveAt: periodEnd,
        periodEnd: periodEnd + MONTH,
      }),
    ]
    const ent = deriveEntitlement(e, periodEnd + DAY) // past first end, inside second
    expect(ent.plan).toBe('pro')
    expect(ent.currentPeriodEnd).toBe(periodEnd + MONTH)
  })

  it('PaymentFailed_IsPastDueAndInGraceUntilGraceEnd', () => {
    const graceUntil = now + 7 * DAY
    const e = [
      ev({ source: 'stripe', type: 'subscribed', effectiveAt: T, periodEnd }),
      ev({ source: 'stripe', type: 'payment_failed', effectiveAt: now, graceUntil }),
    ]
    const ent = deriveEntitlement(e, now + DAY)
    expect(ent).toMatchObject({
      plan: 'pro',
      status: 'past_due',
      inGrace: true,
      currentPeriodEnd: graceUntil,
    })
  })

  it('PaymentFailed_AfterGrace_LapsesToFree', () => {
    const graceUntil = now + 7 * DAY
    const e = [
      ev({ source: 'stripe', type: 'subscribed', effectiveAt: T, periodEnd }),
      ev({ source: 'stripe', type: 'payment_failed', effectiveAt: now, graceUntil }),
    ]
    expect(deriveEntitlement(e, graceUntil + 1).plan).toBe('free')
  })

  it('Recovered_ReturnsToActive', () => {
    const e = [
      ev({ source: 'stripe', type: 'subscribed', effectiveAt: T, periodEnd }),
      ev({ source: 'stripe', type: 'payment_failed', effectiveAt: now, graceUntil: now + 7 * DAY }),
      ev({
        source: 'stripe',
        type: 'recovered',
        effectiveAt: now + DAY,
        periodEnd: periodEnd + MONTH,
      }),
    ]
    const ent = deriveEntitlement(e, now + 2 * DAY)
    expect(ent).toMatchObject({ plan: 'pro', status: 'active', inGrace: false })
  })

  it('Canceled_StaysProUntilPeriodEndThenFree', () => {
    const e = [
      ev({ source: 'stripe', type: 'subscribed', effectiveAt: T, periodEnd }),
      ev({ source: 'stripe', type: 'canceled', effectiveAt: now, periodEnd }),
    ]
    expect(deriveEntitlement(e, now + DAY)).toMatchObject({
      plan: 'pro',
      status: 'canceled_at_period_end',
    })
    expect(deriveEntitlement(e, periodEnd + DAY).plan).toBe('free')
  })

  it('Revoked_ImmediatelyRemovesPro', () => {
    const e = [
      ev({ source: 'stripe', type: 'subscribed', effectiveAt: T, periodEnd }),
      ev({ source: 'stripe', type: 'revoked', effectiveAt: now }),
    ]
    expect(deriveEntitlement(e, now + DAY).plan).toBe('free')
  })

  it('DuplicateEventId_IsIdempotent', () => {
    const base = ev({ id: 'dup', source: 'stripe', type: 'subscribed', effectiveAt: T, periodEnd })
    const one = deriveEntitlement([base], now)
    const many = deriveEntitlement([base, { ...base }, { ...base }], now)
    expect(many).toEqual(one)
  })

  it('EventReorder_YieldsTheSameEntitlement', () => {
    const e = [
      ev({ id: 'a', source: 'stripe', type: 'subscribed', effectiveAt: T, periodEnd }),
      ev({
        id: 'b',
        source: 'stripe',
        type: 'payment_failed',
        effectiveAt: now,
        graceUntil: now + 7 * DAY,
      }),
      ev({
        id: 'c',
        source: 'stripe',
        type: 'recovered',
        effectiveAt: now + DAY,
        periodEnd: periodEnd + MONTH,
      }),
    ]
    const canonical = deriveEntitlement(e, now + 2 * DAY)
    const permutations = [
      [e[2]!, e[0]!, e[1]!],
      [e[1]!, e[2]!, e[0]!],
      [e[2]!, e[1]!, e[0]!],
      [e[0]!, e[2]!, e[1]!],
    ]
    for (const p of permutations) {
      expect(deriveEntitlement(p, now + 2 * DAY)).toEqual(canonical)
    }
  })

  it('CrossRail_StoreSubscriptionGrantsProToEveryClient', () => {
    // Bought on iOS; a web client asks — the account-level entitlement is Pro.
    const e = [ev({ source: 'app_store', type: 'subscribed', effectiveAt: T, periodEnd })]
    expect(deriveEntitlement(e, now)).toMatchObject({ plan: 'pro', source: 'app_store' })
  })

  it('CrossRail_TwoActiveSources_LongestCoverageWins', () => {
    const e = [
      ev({ source: 'stripe', type: 'subscribed', effectiveAt: T, periodEnd }),
      ev({ source: 'app_store', type: 'subscribed', effectiveAt: T, periodEnd: periodEnd + MONTH }),
    ]
    const ent = deriveEntitlement(e, now)
    expect(ent.source).toBe('app_store') // later periodEnd outlasts stripe's
    expect(ent.currentPeriodEnd).toBe(periodEnd + MONTH)
  })

  it('CrossRail_EqualCoverage_ResolvesByDeterministicPrecedence', () => {
    const e = [
      ev({ source: 'play', type: 'subscribed', effectiveAt: T, periodEnd }),
      ev({ source: 'stripe', type: 'subscribed', effectiveAt: T, periodEnd }),
    ]
    expect(deriveEntitlement(e, now).source).toBe('stripe') // stripe outranks play on a tie
  })

  it('Promo_GrantsProUntilItsEnd', () => {
    const e = [ev({ source: 'promo', type: 'promo_granted', effectiveAt: T, periodEnd })]
    expect(deriveEntitlement(e, now)).toMatchObject({ plan: 'pro', source: 'promo' })
    expect(deriveEntitlement(e, periodEnd + DAY).plan).toBe('free')
  })

  it('Subscribed_WithoutPeriodEnd_IsUnboundedPro', () => {
    // A provider that reports no explicit period end → Pro until an event says otherwise.
    const e = [ev({ source: 'stripe', type: 'subscribed', effectiveAt: T })]
    const ent = deriveEntitlement(e, now + 10 * MONTH)
    expect(ent).toMatchObject({ plan: 'pro', status: 'active', currentPeriodEnd: null })
  })

  it('ExpiredEvent_LapsesToFree', () => {
    const e = [
      ev({ source: 'stripe', type: 'subscribed', effectiveAt: T, periodEnd }),
      ev({ source: 'stripe', type: 'expired', effectiveAt: now }),
    ]
    expect(deriveEntitlement(e, now + DAY).plan).toBe('free')
  })

  it('PaymentFailed_WithoutGraceBound_StaysProUntilRecoveryOrExpiry', () => {
    // No grace bound provided → past_due Pro is retained (unbounded) pending the next event.
    const e = [
      ev({ source: 'stripe', type: 'subscribed', effectiveAt: T, periodEnd }),
      ev({ source: 'stripe', type: 'payment_failed', effectiveAt: now }),
    ]
    const ent = deriveEntitlement(e, now + 100 * DAY)
    expect(ent).toMatchObject({
      plan: 'pro',
      status: 'past_due',
      inGrace: true,
      currentPeriodEnd: null,
    })
  })

  it('UnboundedVsFinite_UnboundedCoverageWinsCrossRail', () => {
    const e = [
      ev({ source: 'app_store', type: 'subscribed', effectiveAt: T, periodEnd }),
      ev({ source: 'stripe', type: 'subscribed', effectiveAt: T }), // unbounded
    ]
    expect(deriveEntitlement(e, now).source).toBe('stripe') // null end outranks finite
  })
})
