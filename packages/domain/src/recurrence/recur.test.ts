import { describe, expect, it } from 'vitest'
import {
  describeRecurrence,
  expandRecurrence,
  isOccurrence,
  truncateBefore,
  type RecurrenceRule,
} from './recur.js'

/**
 * Acceptance for the recurrence core (REQ-060, design v17 §F4). Series are a core feature
 * for every entry type — a daily standup, a weekday commute, football on Tuesdays. Pure,
 * deterministic (ADR-0005): a rule + a start date expand to occurrence dates within a window,
 * respecting the end (never / until / count); editing "this vs the series from here" splits
 * the series the Outlook way.
 */
const never = { kind: 'never' } as const

describe('expandRecurrence', () => {
  it('NoneYieldsJustTheStartWhenInWindow', () => {
    const rule: RecurrenceRule = { freq: 'none', end: never }
    expect(expandRecurrence(rule, '2026-07-20', '2026-07-01', '2026-07-31')).toEqual(['2026-07-20'])
    expect(expandRecurrence(rule, '2026-07-20', '2026-08-01', '2026-08-31')).toEqual([])
  })

  it('DailyIsEveryWeekday_SkippingWeekends', () => {
    // 2026-07-20 is a Monday → Mon..Fri, then skip Sat/Sun.
    const rule: RecurrenceRule = { freq: 'daily', end: never }
    expect(expandRecurrence(rule, '2026-07-20', '2026-07-20', '2026-07-26')).toEqual([
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
    ])
  })

  it('WeeklyRepeatsOnTheSameWeekday', () => {
    const rule: RecurrenceRule = { freq: 'weekly', end: never }
    expect(expandRecurrence(rule, '2026-07-07', '2026-07-01', '2026-07-31')).toEqual([
      '2026-07-07',
      '2026-07-14',
      '2026-07-21',
      '2026-07-28',
    ])
  })

  it('MonthlyRepeatsOnTheSameDayOfMonth', () => {
    const rule: RecurrenceRule = { freq: 'monthly', end: never }
    expect(expandRecurrence(rule, '2026-01-15', '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
      '2026-04-15',
    ])
  })

  it('MonthlySkipsMonthsWithoutTheDay_NoDriftToTheFirst', () => {
    // The 31st: Feb/Apr/Jun have no 31st → skipped, not clamped to the 1st/28th.
    const rule: RecurrenceRule = { freq: 'monthly', end: never }
    expect(expandRecurrence(rule, '2026-01-31', '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-03-31',
      '2026-05-31',
    ])
  })

  it('HonoursTheUntilEnd_Inclusive', () => {
    const rule: RecurrenceRule = { freq: 'weekly', end: { kind: 'until', date: '2026-07-21' } }
    expect(expandRecurrence(rule, '2026-07-07', '2026-07-01', '2026-08-31')).toEqual([
      '2026-07-07',
      '2026-07-14',
      '2026-07-21',
    ])
  })

  it('HonoursTheCountEnd_IncludingTheFirst', () => {
    const rule: RecurrenceRule = { freq: 'weekly', end: { kind: 'count', count: 2 } }
    expect(expandRecurrence(rule, '2026-07-07', '2026-07-01', '2026-08-31')).toEqual([
      '2026-07-07',
      '2026-07-14',
    ])
  })

  it('ReturnsEmptyForAWindowBeforeTheStart', () => {
    const rule: RecurrenceRule = { freq: 'weekly', end: never }
    expect(expandRecurrence(rule, '2026-07-07', '2026-06-01', '2026-06-30')).toEqual([])
  })
})

describe('isOccurrence', () => {
  it('IsTrueOnlyForDatesTheSeriesLandsOn', () => {
    const rule: RecurrenceRule = { freq: 'weekly', end: never }
    expect(isOccurrence(rule, '2026-07-07', '2026-07-21')).toBe(true)
    expect(isOccurrence(rule, '2026-07-07', '2026-07-20')).toBe(false)
    expect(isOccurrence(rule, '2026-07-07', '2026-07-06')).toBe(false) // before the start
  })
})

describe('truncateBefore — "series from here" split (Outlook convention)', () => {
  it('EndsTheOriginalSeriesTheDayBeforeTheEditedOccurrence', () => {
    const rule: RecurrenceRule = { freq: 'weekly', end: never }
    expect(truncateBefore(rule, '2026-07-21')).toEqual({
      freq: 'weekly',
      end: { kind: 'until', date: '2026-07-20' },
    })
  })
})

describe('describeRecurrence', () => {
  it('GivesAPlainEnglishLabelWithTheEnd', () => {
    expect(describeRecurrence({ freq: 'none', end: never })).toBe('Does not repeat')
    expect(describeRecurrence({ freq: 'daily', end: never })).toBe('Every weekday')
    expect(describeRecurrence({ freq: 'weekly', end: { kind: 'count', count: 6 } })).toBe(
      'Weekly, 6 times',
    )
    expect(
      describeRecurrence({ freq: 'monthly', end: { kind: 'until', date: '2026-12-31' } }),
    ).toBe('Monthly, until 2026-12-31')
  })
})
