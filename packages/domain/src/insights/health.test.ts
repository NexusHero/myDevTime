import { describe, expect, it } from 'vitest'
import { balanceRow, compareToBaseline, personalBaseline, type BalanceInput } from './health.js'

/**
 * Acceptance for the Health & Balance core (REQ-058, design v14 §H). Two binding pieces:
 * the **baseline principle** (H3) — every health signal calibrates to the person's *own*
 * >4-week norm (mean + spread), never a fixed threshold ("`>45h = red` is bevormundend") —
 * and the honest **Balance row** (H1) split into Work / Protected / Free over waking hours.
 * Pure and deterministic (ADR-0005); nothing here is a diagnosis.
 */
describe('personalBaseline', () => {
  it('IsMeanAndPopulationSpreadOfTheOwnHistory', () => {
    const b = personalBaseline([600, 600, 600, 600])
    expect(b).not.toBeNull()
    expect(b?.mean).toBe(600)
    expect(b?.spread).toBe(0)
    expect(b?.n).toBe(4)
  })

  it('IsNullBelowTheMinimumPeriods_NoJudgingWithoutEnoughOwnData', () => {
    expect(personalBaseline([600, 600, 600])).toBeNull() // <4 periods
  })

  it('ComputesSpreadFromScatter', () => {
    // values 2,4,4,4,5,5,7,9 → mean 5, population variance 4 → spread 2.
    const b = personalBaseline([2, 4, 4, 4, 5, 5, 7, 9])
    expect(b?.mean).toBe(5)
    expect(b?.spread).toBe(2)
  })
})

describe('compareToBaseline — relative to the person, never a fixed threshold', () => {
  it('SameAbsoluteValueReadsDifferentlyAgainstDifferentPersonalBaselines', () => {
    // 50h weeks: the point of §H3. For a person who normally works ~50h it is typical;
    // for a person who normally works ~40h with a tight spread it is above their norm.
    const marathoner = [50, 50, 50, 50, 50, 50] // mean 50
    const nineToFive = [40, 40, 40, 41, 39, 40] // mean ~40, tight spread

    expect(compareToBaseline(50, marathoner)?.band).toBe('typical')
    expect(compareToBaseline(50, nineToFive)?.band).toBe('above')
  })

  it('FlagsBelowWhenTheCurrentValueDropsPastTheOwnSpread', () => {
    const history = [40, 42, 38, 40, 41, 39] // mean 40, small spread
    expect(compareToBaseline(30, history)?.band).toBe('below')
  })

  it('ReportsSignedDeviationInSpreadsForTheOwnDistribution', () => {
    const history = [2, 4, 4, 4, 5, 5, 7, 9] // mean 5, spread 2
    const cmp = compareToBaseline(9, history)
    expect(cmp?.z).toBe(2) // (9 − 5) / 2
    expect(cmp?.band).toBe('above')
  })

  it('IsNullWithoutEnoughOwnHistory', () => {
    expect(compareToBaseline(50, [50, 50])).toBeNull()
  })

  it('WithAPerfectlySteadyHistory_AnyDepartureIsNotedButZIsNotDivided', () => {
    const steady = [40, 40, 40, 40] // spread 0
    expect(compareToBaseline(45, steady)?.band).toBe('above')
    expect(compareToBaseline(40, steady)?.band).toBe('typical')
    expect(compareToBaseline(45, steady)?.z).toBe(0)
  })
})

describe('balanceRow — Work / Protected / Free over waking hours', () => {
  it('SplitsWakingTimeAndFreeIsTheRemainder', () => {
    const input: BalanceInput = { workMin: 480, protectedMin: 120, wakingMin: 960 }
    const row = balanceRow(input)
    expect(row.workMin).toBe(480)
    expect(row.protectedMin).toBe(120)
    expect(row.freeMin).toBe(360) // 960 − 480 − 120
    expect(row.workShare).toBeCloseTo(0.5, 5)
    expect(row.protectedShare).toBeCloseTo(0.125, 5)
    expect(row.freeShare).toBeCloseTo(0.375, 5)
  })

  it('ClampsFreeAtZeroWhenWorkPlusProtectedExceedsWaking', () => {
    const row = balanceRow({ workMin: 700, protectedMin: 400, wakingMin: 960 })
    expect(row.freeMin).toBe(0)
  })

  it('SharesAreZeroWhenWakingIsUnknown', () => {
    const row = balanceRow({ workMin: 480, protectedMin: 60, wakingMin: 0 })
    expect(row.workShare).toBe(0)
    expect(row.protectedShare).toBe(0)
    expect(row.freeShare).toBe(0)
    expect(row.freeMin).toBe(0)
  })
})
