import { describe, expect, it } from 'vitest'
import { rateAmountAt, resolveRate, type RateRule } from './rates.js'

/**
 * Rate resolution (REQ-005): specificity first, effective date second, and
 * never retroactive.
 */
const at = (iso: string): number => Date.parse(iso)

describe('resolveRate', () => {
  it('ResolveRate_MoreSpecificLevel_WinsOverBroaderEvenIfOlder', () => {
    const rules: RateRule[] = [
      { level: 'workspace', amountMinorPerHour: 5000, effectiveFrom: at('2026-06-01') },
      { level: 'task', amountMinorPerHour: 9000, effectiveFrom: at('2020-01-01') },
    ]
    expect(resolveRate(rules, at('2026-07-01'))?.amountMinorPerHour).toBe(9000)
  })

  it('ResolveRate_WithinLevel_PicksLatestEffectiveAtOrBefore', () => {
    const rules: RateRule[] = [
      { level: 'project', amountMinorPerHour: 6000, effectiveFrom: at('2026-01-01') },
      { level: 'project', amountMinorPerHour: 7000, effectiveFrom: at('2026-06-01') },
    ]
    expect(resolveRate(rules, at('2026-07-01'))?.amountMinorPerHour).toBe(7000)
    expect(resolveRate(rules, at('2026-03-01'))?.amountMinorPerHour).toBe(6000)
  })

  it('ResolveRate_FutureDatedRate_IsIgnoredUntilEffective', () => {
    const rules: RateRule[] = [
      { level: 'project', amountMinorPerHour: 6000, effectiveFrom: at('2026-01-01') },
      { level: 'project', amountMinorPerHour: 8000, effectiveFrom: at('2026-12-01') },
    ]
    // An entry in July is priced with the January rate, not the future one.
    expect(resolveRate(rules, at('2026-07-01'))?.amountMinorPerHour).toBe(6000)
  })

  it('ResolveRate_MostSpecificLevelNotYetEffective_FallsToBroader', () => {
    const rules: RateRule[] = [
      { level: 'task', amountMinorPerHour: 9000, effectiveFrom: at('2026-12-01') },
      { level: 'project', amountMinorPerHour: 6000, effectiveFrom: at('2026-01-01') },
    ]
    // The task rate isn't in effect yet in July → project rate applies.
    expect(resolveRate(rules, at('2026-07-01'))?.amountMinorPerHour).toBe(6000)
  })

  it('ResolveRate_NoRuleInEffect_IsNull', () => {
    const rules: RateRule[] = [
      { level: 'workspace', amountMinorPerHour: 5000, effectiveFrom: at('2026-12-01') },
    ]
    expect(resolveRate(rules, at('2026-07-01'))).toBeNull()
    expect(resolveRate([], at('2026-07-01'))).toBeNull()
  })

  it('ResolveRate_NonRetroactive_OldEntryKeepsOldRate', () => {
    const rules: RateRule[] = [
      { level: 'client', amountMinorPerHour: 5000, effectiveFrom: at('2026-01-01') },
      { level: 'client', amountMinorPerHour: 7000, effectiveFrom: at('2026-06-01') },
    ]
    // Work done in March is still valued at the March-era rate after a June raise.
    expect(resolveRate(rules, at('2026-03-15'))?.amountMinorPerHour).toBe(5000)
  })
})

describe('rateAmountAt', () => {
  it('RateAmountAt_NothingInEffect_IsZero', () => {
    expect(rateAmountAt([], at('2026-07-01'))).toBe(0)
  })

  it('RateAmountAt_RuleInEffect_ReturnsAmount', () => {
    const rules: RateRule[] = [
      { level: 'project', amountMinorPerHour: 6500, effectiveFrom: at('2026-01-01') },
    ]
    expect(rateAmountAt(rules, at('2026-07-01'))).toBe(6500)
  })
})
