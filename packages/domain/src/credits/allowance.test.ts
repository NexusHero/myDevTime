import { describe, expect, it } from 'vitest'
import { TOPUP_PACKS, monthlyCreditAllowance, topUpPackCredits } from './allowance.js'

/**
 * The credit-entitlement config is the single source for what a plan's monthly allowance
 * and each top-up pack grant. These pin the plan amounts and the pack lookup (unknown → null).
 */
describe('monthlyCreditAllowance', () => {
  it('FreeEarnsNothingFromRenewals_ProEarnsItsBundle', () => {
    expect(monthlyCreditAllowance('free')).toBe(0)
    expect(monthlyCreditAllowance('pro')).toBe(500)
  })
})

describe('topUpPackCredits', () => {
  it('KnownPack_ReturnsItsCredits', () => {
    expect(topUpPackCredits('pack_small')).toBe(200)
    expect(topUpPackCredits('pack_large')).toBe(1200)
  })

  it('UnknownPack_IsNull', () => {
    expect(topUpPackCredits('pack_bogus')).toBeNull()
    expect(topUpPackCredits('')).toBeNull()
  })

  it('EveryCatalogPackResolves', () => {
    for (const pack of TOPUP_PACKS) {
      expect(topUpPackCredits(pack.id)).toBe(pack.credits)
      expect(pack.credits).toBeGreaterThan(0)
    }
  })
})
