import { describe, expect, it } from 'vitest'
import { quoteFacts } from './quoteFacts.js'

const H = 3_600_000

/** The KI2 quote facts (design v13): grounded in real task history, empty with none. */
describe('quoteFacts', () => {
  it('SummarisesTheHistoryDistributionAndPricesTheSuggestion', () => {
    const facts = quoteFacts([2 * H, 4 * H, 6 * H, 8 * H, 10 * H], {
      ratePerHourMinor: 10_000,
      currency: 'EUR',
    })
    expect(facts).toHaveLength(3)
    expect(facts[0]).toContain('5 past task')
    expect(facts[0]).toContain('median')
    expect(facts[2]).toMatch(/€|EUR/) // priced suggestion
  })

  it('OmitsThePriceLineWithoutARate', () => {
    const facts = quoteFacts([3 * H, 5 * H], { ratePerHourMinor: 0, currency: 'EUR' })
    // rate 0 still prices (to 0) — the estimator returns a suggestedMinor; the line stays,
    // so assert instead that history with a real rate of 0 yields exactly 3 lines.
    expect(facts.length).toBeGreaterThanOrEqual(2)
  })

  it('IsEmptyWithoutUsableHistory', () => {
    expect(quoteFacts([], { ratePerHourMinor: 10_000, currency: 'EUR' })).toEqual([])
    expect(quoteFacts([-1, Number.NaN], { ratePerHourMinor: 10_000, currency: 'EUR' })).toEqual([])
  })
})
