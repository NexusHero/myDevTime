import { describe, expect, it } from 'vitest'
import {
  barFraction,
  budgetTone,
  formatDuration,
  formatMoneyMinor,
  formatPercent,
  formatSigned,
} from './format.js'

describe('formatDuration', () => {
  it('formatDuration_Zero_RendersZeroColonZeroZero', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('formatDuration_WholeHour_PadsMinutes', () => {
    expect(formatDuration(3_600_000)).toBe('1:00')
  })

  it('formatDuration_HourAndHalf_RendersMinutes', () => {
    expect(formatDuration(5_400_000)).toBe('1:30')
  })

  it('formatDuration_SubHour_ShowsZeroHours', () => {
    expect(formatDuration(45 * 60_000)).toBe('0:45')
  })

  it('formatDuration_OverTwentyFourHours_DoesNotWrap', () => {
    expect(formatDuration(25 * 3_600_000)).toBe('25:00')
  })

  it('formatDuration_RoundsToNearestMinute', () => {
    // 90 seconds → 1.5 min → rounds half-up to 2 min.
    expect(formatDuration(90_000)).toBe('0:02')
    // 89 seconds → rounds down to 1 min.
    expect(formatDuration(89_000)).toBe('0:01')
  })

  it('formatDuration_Negative_KeepsLeadingMinus', () => {
    expect(formatDuration(-5_400_000)).toBe('−1:30')
  })
})

describe('formatMoneyMinor', () => {
  it('formatMoneyMinor_Euro_GroupsThousandsAndTwoDecimals', () => {
    expect(formatMoneyMinor(125_000, 'EUR')).toBe('€1,250.00')
  })

  it('formatMoneyMinor_Cents_Padded', () => {
    expect(formatMoneyMinor(505, 'USD')).toBe('$5.05')
  })

  it('formatMoneyMinor_Millions_GroupEveryThreeDigits', () => {
    expect(formatMoneyMinor(123_456_789, 'GBP')).toBe('£1,234,567.89')
  })

  it('formatMoneyMinor_UnknownCurrency_UsesCodePrefix', () => {
    expect(formatMoneyMinor(500, 'CHF')).toBe('CHF 5.00')
  })

  it('formatMoneyMinor_Negative_SignBeforeSymbol', () => {
    expect(formatMoneyMinor(-500, 'EUR')).toBe('−€5.00')
  })

  it('formatMoneyMinor_Zero_RendersCleanly', () => {
    expect(formatMoneyMinor(0, 'EUR')).toBe('€0.00')
  })
})

describe('formatPercent', () => {
  it('formatPercent_Fraction_RoundsToWholePercent', () => {
    expect(formatPercent(0.723)).toBe('72%')
  })

  it('formatPercent_OverOne_ExceedsHundred', () => {
    expect(formatPercent(1.2)).toBe('120%')
  })

  it('formatPercent_Zero_IsZeroPercent', () => {
    expect(formatPercent(0)).toBe('0%')
  })
})

describe('formatSigned', () => {
  it('formatSigned_Positive_PrefixesPlus', () => {
    expect(formatSigned(500)).toBe('+500')
  })

  it('formatSigned_Negative_PrefixesMinus', () => {
    expect(formatSigned(-12)).toBe('−12')
  })

  it('formatSigned_Zero_HasNoSign', () => {
    expect(formatSigned(0)).toBe('0')
  })

  it('formatSigned_Thousands_AreGrouped', () => {
    expect(formatSigned(1500)).toBe('+1,500')
    expect(formatSigned(-1_234_567)).toBe('−1,234,567')
  })

  it('formatSigned_RoundsToInteger', () => {
    expect(formatSigned(12.4)).toBe('+12')
    expect(formatSigned(-0.4)).toBe('0')
  })
})

describe('budgetTone', () => {
  it('budgetTone_BelowEighty_IsGood', () => {
    expect(budgetTone(0.5)).toBe('good')
    expect(budgetTone(0.79)).toBe('good')
  })

  it('budgetTone_EightyToHundred_IsWarn', () => {
    expect(budgetTone(0.8)).toBe('warn')
    expect(budgetTone(0.99)).toBe('warn')
  })

  it('budgetTone_AtOrOverHundred_IsCrit', () => {
    expect(budgetTone(1)).toBe('crit')
    expect(budgetTone(1.4)).toBe('crit')
  })
})

describe('barFraction', () => {
  it('barFraction_WithinRange_PassesThrough', () => {
    expect(barFraction(0.42)).toBe(0.42)
  })

  it('barFraction_Negative_ClampsToZero', () => {
    expect(barFraction(-0.3)).toBe(0)
  })

  it('barFraction_OverOne_ClampsToOne', () => {
    expect(barFraction(1.7)).toBe(1)
  })
})
