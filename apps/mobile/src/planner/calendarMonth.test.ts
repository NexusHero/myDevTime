import { describe, expect, it } from 'vitest'
import { buildMonthDays, buildYearMonths, type CalendarEvent } from './calendarMonth.js'
import type { Occurrence } from '../api/recurrence'

const occ = (
  date: string,
  lenMin: number,
  title: string,
  projectId: string | null = null,
  priority: number | null = null,
): Occurrence => ({
  seriesId: 's',
  kind: 'focus',
  title,
  date,
  startMin: 540,
  lenMin,
  projectId,
  priority,
  note: null,
})

describe('buildMonthDays', () => {
  it('BucketsOccurrencesByDay_asTasksWithLoad', () => {
    const days = buildMonthDays(
      [occ('2026-07-13', 120, 'Sync engine', 'p2'), occ('2026-07-13', 60, 'Review', 'p1')],
      [],
      { year: 2026, month0: 6 },
    )
    const day13 = days.get(13)
    expect(day13?.tasks).toHaveLength(2)
    // Both default to prio 2 (weight 1.0): 2h + 1h = 3h load.
    expect(day13?.load).toBe(3)
    expect(day13?.tasks[0]?.label).toBe('Sync engine')
    expect(day13?.tasks[0]?.projectId).toBe('p2')
  })

  it('EventsNeverCountTowardLoad', () => {
    const events: CalendarEvent[] = [{ date: '2026-07-17', label: 'Vacation' }]
    const days = buildMonthDays([], events, { year: 2026, month0: 6 })
    const day17 = days.get(17)
    expect(day17?.events).toEqual([{ label: 'Vacation' }])
    expect(day17?.tasks).toEqual([])
    expect(day17?.load).toBe(0)
  })

  it('LifeOccurrencesShow_butNeverCountTowardLoad', () => {
    // Life is personal, never work time (design v19): it appears on the day but the
    // load bar (planned-work severity) must ignore it.
    const life: Occurrence = {
      seriesId: 'l',
      kind: 'life',
      title: 'Kita pickup',
      date: '2026-07-13',
      startMin: 990,
      lenMin: 60,
      projectId: null,
      priority: null,
      note: null,
    }
    const days = buildMonthDays([occ('2026-07-13', 120, 'Sync engine', 'p1'), life], [], {
      year: 2026,
      month0: 6,
    })
    const day13 = days.get(13)
    expect(day13?.tasks).toHaveLength(2) // both still surface in the cell
    expect(day13?.tasks.find(t => t.label === 'Kita pickup')?.isLife).toBe(true)
    expect(day13?.tasks.find(t => t.label === 'Sync engine')?.isLife).toBe(false)
    expect(day13?.load).toBe(2) // only the 2h focus block counts; life excluded
  })

  it('IgnoresOccurrencesOutsideTheMonth', () => {
    const days = buildMonthDays([occ('2026-08-01', 60, 'Next month')], [], {
      year: 2026,
      month0: 6,
    })
    expect(days.size).toBe(0)
  })

  it('CarriesTheSeriesPriority_orDefaultsToMedium', () => {
    const days = buildMonthDays(
      [occ('2026-07-13', 60, 'High one', 'p1', 1), occ('2026-07-13', 60, 'No prio', 'p2')],
      [],
      { year: 2026, month0: 6 },
    )
    const tasks = days.get(13)?.tasks ?? []
    expect(tasks.find(t => t.label === 'High one')?.prio).toBe(1) // real stored priority
    expect(tasks.find(t => t.label === 'No prio')?.prio).toBe(2) // default medium
  })

  it('EmptyInput_EmptyMap', () => {
    expect(buildMonthDays([], [], { year: 2026, month0: 6 }).size).toBe(0)
  })
})

describe('buildYearMonths', () => {
  it('ReturnsTwelveMonths_withCurrentFlagged', () => {
    const months = buildYearMonths([], [], { year: 2026, nowMonth0: 6 })
    expect(months).toHaveLength(12)
    expect(months[6]?.isNow).toBe(true)
    expect(months[6]?.name).toBe('Jul')
    expect(months[0]?.isNow).toBe(false)
  })

  it('SumsPlannedHoursPerMonth', () => {
    const months = buildYearMonths([occ('2026-07-01', 120, 'A'), occ('2026-07-15', 180, 'B')], [], {
      year: 2026,
      nowMonth0: 6,
    })
    expect(months[6]?.hours).toBe(5) // 2h + 3h
  })

  it('CountsEventsPerMonth', () => {
    const months = buildYearMonths([], [{ date: '2026-03-10', label: 'Holiday' }], {
      year: 2026,
      nowMonth0: 6,
    })
    expect(months[2]?.eventCount).toBe(1)
  })

  it('LifeHoursDoNotCountAsPlannedWork', () => {
    const life: Occurrence = {
      seriesId: 'l',
      kind: 'life',
      title: 'School run',
      date: '2026-07-05',
      startMin: 990,
      lenMin: 120,
      projectId: null,
      priority: null,
      note: null,
    }
    const months = buildYearMonths([life], [], { year: 2026, nowMonth0: 6 })
    expect(months[6]?.hours).toBe(0) // life is not planned work
    expect(months[6]?.weekLoads).toEqual([0, 0, 0, 0, 0])
  })

  it('EmptyMonth_ZeroHoursAllIdle', () => {
    const months = buildYearMonths([], [], { year: 2026, nowMonth0: 6 })
    expect(months[0]?.hours).toBe(0)
    expect(months[0]?.weekLoads).toEqual([0, 0, 0, 0, 0])
  })
})
