import { describe, expect, it } from 'vitest'
import { daysInMonth, monthGrid, weekdayHeaders } from './calendar.js'

/**
 * The month grid is deterministic geometry (ADR-0005), pinned against known
 * calendars: July 2026 starts on a Wednesday, so a Monday-first grid leads with
 * two June days; the leap-year February and the January year-boundary (leading
 * days come from the *previous year's* December) are the edge cases.
 */
describe('daysInMonth', () => {
  it('LeapFebruary_Has29Days', () => {
    expect(daysInMonth(2024, 1)).toBe(29)
  })
  it('NonLeapFebruary_Has28Days', () => {
    expect(daysInMonth(2026, 1)).toBe(28)
  })
  it('OutOfRangeMonth_Throws', () => {
    expect(() => daysInMonth(2026, 12)).toThrow('month0 must be 0–11')
  })
})

describe('monthGrid', () => {
  it('AlwaysReturnsSixWeeksOfSeven', () => {
    const grid = monthGrid(2026, 6)
    expect(grid).toHaveLength(6)
    expect(grid.every(w => w.length === 7)).toBe(true)
  })

  it('MondayStart_July2026_LeadsWithTwoJuneDays', () => {
    // Jul 1 2026 is a Wednesday → two leading days (Mon 29, Tue 30 June).
    const grid = monthGrid(2026, 6, true)
    expect(grid[0]![0]).toEqual({ date: 29, inMonth: false })
    expect(grid[0]![1]).toEqual({ date: 30, inMonth: false })
    expect(grid[0]![2]).toEqual({ date: 1, inMonth: true })
  })

  it('SundayStart_July2026_LeadsWithThreeDays', () => {
    const grid = monthGrid(2026, 6, false)
    expect(grid[0]![3]).toEqual({ date: 1, inMonth: true })
    expect(grid[0]!.slice(0, 3).every(c => !c.inMonth)).toBe(true)
  })

  it('InMonthCount_EqualsDaysInMonth', () => {
    const inMonth = monthGrid(2026, 6)
      .flat()
      .filter(c => c.inMonth)
    expect(inMonth).toHaveLength(31)
    expect(inMonth[0]!.date).toBe(1)
    expect(inMonth.at(-1)!.date).toBe(31)
  })

  it('January_LeadingDaysComeFromPreviousDecember', () => {
    // Jan 1 2026 is a Thursday → three leading days from Dec 2025 (29, 30, 31).
    const grid = monthGrid(2026, 0, true)
    expect(grid[0]!.slice(0, 3)).toEqual([
      { date: 29, inMonth: false },
      { date: 30, inMonth: false },
      { date: 31, inMonth: false },
    ])
    expect(grid[0]![3]).toEqual({ date: 1, inMonth: true })
  })

  it('OutOfRangeMonth_Throws', () => {
    expect(() => monthGrid(2026, -1)).toThrow('month0 must be 0–11')
  })
})

describe('weekdayHeaders', () => {
  it('MondayFirst_StartsMondayEndsSunday', () => {
    expect(weekdayHeaders(true)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])
  })
  it('SundayFirst_StartsSunday', () => {
    expect(weekdayHeaders(false)).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'])
  })
})
