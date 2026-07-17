import { describe, expect, it } from 'vitest'
import { WAKING_MIN_PER_WEEK, weeklyBalance } from './balanceRow.js'

/**
 * The Reports Balance-row glue (REQ-058, design v14 §H): it feeds the deterministic
 * `balanceRow` (Work/Protected/Free) and `compareToBaseline` (this week vs the person's own
 * normal) from the trailing weekly focus totals.
 */
describe('weeklyBalance', () => {
  it('IsNullWhenThereIsNoData', () => {
    expect(weeklyBalance([])).toBeNull()
  })

  it('SplitsThisWeekIntoWorkAndFreeOfWakingTime', () => {
    const wb = weeklyBalance([480], { wakingMin: 6720 })
    expect(wb).not.toBeNull()
    expect(wb!.row.workMin).toBe(480)
    expect(wb!.row.protectedMin).toBe(0)
    expect(wb!.row.freeMin).toBe(6720 - 480)
  })

  it('DefaultsWakingToTheStatedAssumption', () => {
    const wb = weeklyBalance([600])
    expect(wb!.row.freeMin).toBe(WAKING_MIN_PER_WEEK - 600)
  })

  it('HasNoBaselineBandWithFewerThanFourPriorWeeks', () => {
    // 3 prior weeks + this week → history is 3, below the minimum.
    expect(weeklyBalance([2400, 2400, 2400, 2400])!.band).toBeNull()
  })

  it('BandsThisWeekAgainstTheOwnPriorWeeksNormal_H3', () => {
    // 4 tight prior weeks around 2400; this week 3000 is above the person's own normal.
    const wb = weeklyBalance([2400, 2410, 2390, 2400, 3000])
    expect(wb!.band?.band).toBe('above')
  })

  it('CountsProtectedTimeWhenProvided', () => {
    const wb = weeklyBalance([480], { wakingMin: 6720, protectedMin: 120 })
    expect(wb!.row.protectedMin).toBe(120)
    expect(wb!.row.freeMin).toBe(6720 - 480 - 120)
  })
})
