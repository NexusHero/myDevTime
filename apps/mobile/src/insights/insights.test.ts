import { describe, expect, it } from 'vitest'
import type { Summary } from '../api/reports.js'
import type { Absence } from '../api/absences.js'
import {
  absenceDateSet,
  buildDayFocus,
  focusMinutesByDate,
  lastNDates,
  weekToDateMinutes,
} from './insights.js'

const MIN = 60_000

function summary(days: string[], daily: number[][]): Summary {
  return {
    totalMs: 0,
    billableMs: 0,
    days,
    byProject: daily.map((d, i) => ({
      projectId: `p${String(i)}`,
      spentMs: 0,
      billableMs: 0,
      daily: d,
    })),
  }
}

describe('lastNDates', () => {
  it('ReturnsNAscendingDates_EndingAtToday', () => {
    expect(lastNDates('2026-07-15', 3)).toEqual(['2026-07-13', '2026-07-14', '2026-07-15'])
  })
})

describe('focusMinutesByDate', () => {
  it('SumsProjectsPerDay_InMinutes', () => {
    const s = summary(
      ['2026-07-14', '2026-07-15'],
      [
        [60 * MIN, 120 * MIN],
        [30 * MIN, 0],
      ],
    )
    const m = focusMinutesByDate(s)
    expect(m.get('2026-07-14')).toBe(90)
    expect(m.get('2026-07-15')).toBe(120)
  })
})

describe('absenceDateSet', () => {
  it('ExpandsInclusiveRanges', () => {
    const abs: Absence[] = [
      {
        id: 'a',
        kind: 'vacation',
        startDate: '2026-07-14',
        endDate: '2026-07-16',
        halfDay: false,
        note: null,
      },
    ]
    expect([...absenceDateSet(abs)]).toEqual(['2026-07-14', '2026-07-15', '2026-07-16'])
  })
})

describe('buildDayFocus', () => {
  it('ComposesFocusAndAbsenceFlagsPerDate', () => {
    const dates = ['2026-07-14', '2026-07-15']
    const focus = new Map([['2026-07-15', 200]])
    const absent = new Set(['2026-07-14'])
    expect(buildDayFocus(dates, focus, absent)).toEqual([
      { date: '2026-07-14', focusMin: 0, absence: true },
      { date: '2026-07-15', focusMin: 200, absence: false },
    ])
  })
})

describe('weekToDateMinutes', () => {
  it('SumsMondayThroughToday', () => {
    // 2026-07-15 is a Wednesday → Mon 13, Tue 14, Wed 15.
    const focus = new Map([
      ['2026-07-13', 100],
      ['2026-07-14', 200],
      ['2026-07-15', 50],
      ['2026-07-12', 999], // Sunday of the previous week — excluded
    ])
    expect(weekToDateMinutes(focus, '2026-07-15')).toBe(350)
  })
})
