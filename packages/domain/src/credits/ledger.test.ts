import { describe, expect, it } from 'vitest'
import { canDebit, creditBalance, usageByCategory, type CreditEntry } from './ledger.js'

/**
 * The AI-credit ledger core (REQ-027, ADR-0008): an append-only log of signed
 * deltas — grants/top-ups add, debits subtract — with the balance and the usage
 * breakdown derived from it. Deterministic and pure (ADR-0005); a feature gate
 * reads the balance here, never a payment SDK.
 */
const e = (kind: CreditEntry['kind'], amount: number, category: string): CreditEntry => ({
  kind,
  amount,
  category,
  at: '2026-07-08T00:00:00.000Z',
})

const LEDGER: CreditEntry[] = [
  e('grant', 500, 'monthly-grant'),
  e('debit', -8, 'meeting-insights'),
  e('debit', -4, 'nl-entry'),
  e('debit', -1, 'assistant'),
  e('debit', -2, 'co-planner'),
  e('debit', -3, 'meeting-insights'),
]

describe('creditBalance', () => {
  it('SumsSignedDeltas', () => {
    expect(creditBalance(LEDGER)).toBe(500 - 8 - 4 - 1 - 2 - 3)
  })
  it('IsZeroForAnEmptyLedger', () => {
    expect(creditBalance([])).toBe(0)
  })
})

describe('usageByCategory', () => {
  it('AggregatesDebitsAsPositiveCreditsPerCategoryDescending', () => {
    const usage = usageByCategory(LEDGER)
    expect(usage).toEqual([
      { category: 'meeting-insights', credits: 11 },
      { category: 'nl-entry', credits: 4 },
      { category: 'co-planner', credits: 2 },
      { category: 'assistant', credits: 1 },
    ])
  })
  it('IgnoresGrantsAndTopUps', () => {
    expect(usageByCategory([e('grant', 500, 'monthly-grant'), e('topup', 100, 'pack')])).toEqual([])
  })
})

describe('canDebit', () => {
  it('IsTrueWhenTheBalanceCoversTheAmount', () => {
    expect(canDebit(LEDGER, 100)).toBe(true)
  })
  it('IsFalseWhenTheDebitWouldOverdraw', () => {
    expect(canDebit(LEDGER, 1000)).toBe(false)
  })
  it('RejectsNonPositiveAmounts', () => {
    expect(canDebit(LEDGER, 0)).toBe(false)
    expect(canDebit(LEDGER, -5)).toBe(false)
  })
})
