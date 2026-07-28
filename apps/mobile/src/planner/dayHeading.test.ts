import { describe, expect, it } from 'vitest'
import { dayHeading } from './dayHeading.js'

/**
 * The Day view's date header (issue #381). The day you are looking at was only ever a small
 * column label shared with the week grid — on the Day stage, where there is exactly one day,
 * that is the one thing the screen should say plainly.
 */
describe('dayHeading', () => {
  // A fixed local noon, so the heading never lands on the neighbouring day through a timezone
  // offset — the same instant must always name the same calendar day.
  const noon = (y: number, m: number, d: number): number => new Date(y, m, d, 12).getTime()

  it('NamesTheDateAndItsWeekdaySeparately', () => {
    const h = dayHeading(noon(2026, 6, 27), 'en-US')
    expect(h.date).toBe('July 27, 2026')
    expect(h.weekday).toBe('Monday')
  })

  it('FollowsTheGivenLocale', () => {
    const h = dayHeading(noon(2026, 6, 27), 'de-DE')
    expect(h.date).toContain('2026')
    expect(h.date).toContain('27')
    // German names the month in German — the heading is never hard-coded English.
    expect(h.date.toLowerCase()).toContain('juli')
    expect(h.weekday).toBe('Montag')
  })

  it('SplitsTheEmphasisedDayNumberOutOfTheDate', () => {
    // Apple's calendar sets the day number heavier than the rest ("July **27**, 2026"). The
    // split is data, not styling, so the view can weight the parts without parsing a string.
    const h = dayHeading(noon(2026, 6, 27), 'en-US')
    expect(h.dayNumber).toBe('27')
    expect(h.date.includes(h.dayNumber)).toBe(true)
  })

  it('IsStableAcrossTheWholeDay', () => {
    // Any instant within the local day yields the same heading — a header must not flicker
    // between two dates as the clock moves.
    const early = dayHeading(new Date(2026, 6, 27, 0, 1).getTime(), 'en-US')
    const late = dayHeading(new Date(2026, 6, 27, 23, 59).getTime(), 'en-US')
    expect(early).toEqual(late)
  })

  it('HandlesASingleDigitDayWithoutPadding', () => {
    const h = dayHeading(noon(2026, 6, 3), 'en-US')
    expect(h.dayNumber).toBe('3')
    expect(h.date).toBe('July 3, 2026')
  })
})
