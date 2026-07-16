import { describe, expect, it } from 'vitest'
import { rangeLabel, reportWindow } from './window.js'

/**
 * The report window resolves each range to a deterministic `[from, to)` UTC window.
 * Week stays a trailing 7 days ending at the next UTC midnight; month/year snap to
 * the current UTC calendar month/year. `now` is injected so the assertions are exact.
 */
describe('rangeLabel', () => {
  it('Week_LabelsWeek', () => {
    expect(rangeLabel('week')).toBe('Week')
  })
  it('Month_LabelsMonth', () => {
    expect(rangeLabel('month')).toBe('Month')
  })
  it('Year_LabelsYear', () => {
    expect(rangeLabel('year')).toBe('Year')
  })
})

describe('reportWindow', () => {
  const now = new Date('2026-07-16T13:45:00.000Z')

  it('Week_IsTrailingSevenDaysToNextUtcMidnight', () => {
    expect(reportWindow('week', now)).toEqual({
      from: '2026-07-10T00:00:00.000Z',
      to: '2026-07-17T00:00:00.000Z',
      tz: 'UTC',
    })
  })

  it('Month_IsTheCurrentUtcCalendarMonth', () => {
    expect(reportWindow('month', now)).toEqual({
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-08-01T00:00:00.000Z',
      tz: 'UTC',
    })
  })

  it('Month_RollsOverTheYearInDecember', () => {
    expect(reportWindow('month', new Date('2026-12-31T23:59:59.000Z'))).toEqual({
      from: '2026-12-01T00:00:00.000Z',
      to: '2027-01-01T00:00:00.000Z',
      tz: 'UTC',
    })
  })

  it('Year_IsTheCurrentUtcCalendarYear', () => {
    expect(reportWindow('year', now)).toEqual({
      from: '2026-01-01T00:00:00.000Z',
      to: '2027-01-01T00:00:00.000Z',
      tz: 'UTC',
    })
  })
})
