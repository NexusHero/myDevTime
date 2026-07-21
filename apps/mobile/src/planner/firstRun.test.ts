import { describe, expect, it } from 'vitest'
import { firstRunDayBlocks, firstRunGhostWeek, firstRunPlannableDates } from './firstRun.js'

/**
 * Sevi first run (REQ-074): the ghost week is pure, deterministic layout from the
 * answers — no LLM, no randomness, no demo data. These tests pin the layout rules
 * and the never-plan-the-past date choice.
 */

describe('firstRunDayBlocks', () => {
  it('NineToFive_AlternatesFocusAndBreaksDeterministically', () => {
    const blocks = firstRunDayBlocks({ startMin: 540, topic: 'Sync-Engine', endMin: 1020 })
    expect(blocks).toEqual([
      { startMin: 540, lenMin: 120, kind: 'focus', label: 'Sync-Engine' },
      { startMin: 660, lenMin: 30, kind: 'break', label: 'Pause' },
      { startMin: 690, lenMin: 120, kind: 'focus', label: 'Sync-Engine' },
      { startMin: 810, lenMin: 30, kind: 'break', label: 'Pause' },
      { startMin: 840, lenMin: 120, kind: 'focus', label: 'Sync-Engine' },
      { startMin: 960, lenMin: 60, kind: 'focus', label: 'Sync-Engine' },
    ])
  })

  it('SameAnswers_SameBlocks_Deterministic', () => {
    const a = { startMin: 480, topic: 'Review', endMin: 900 }
    expect(firstRunDayBlocks(a)).toEqual(firstRunDayBlocks(a))
  })

  it('TinyWindow_DropsTheSliverInsteadOfPaddingIt', () => {
    // 20 minutes of room → nothing is planned; the plan never pads.
    expect(firstRunDayBlocks({ startMin: 540, topic: 'X', endMin: 560 })).toEqual([])
    // 45 minutes → one short focus block, no break.
    expect(firstRunDayBlocks({ startMin: 540, topic: 'X', endMin: 585 })).toEqual([
      { startMin: 540, lenMin: 45, kind: 'focus', label: 'X' },
    ])
  })

  it('EmptyTopic_FallsBackToFokus_WhitespaceTrimmed', () => {
    expect(firstRunDayBlocks({ startMin: 540, topic: '  ', endMin: 660 })[0]?.label).toBe('Fokus')
    expect(firstRunDayBlocks({ startMin: 540, topic: ' Deep ', endMin: 660 })[0]?.label).toBe(
      'Deep',
    )
  })

  it('OutOfRangeAnswers_Throw', () => {
    expect(() => firstRunDayBlocks({ startMin: -1, topic: 'X', endMin: 600 })).toThrow()
    expect(() => firstRunDayBlocks({ startMin: 600, topic: 'X', endMin: 600 })).toThrow()
    expect(() => firstRunDayBlocks({ startMin: 600, topic: 'X', endMin: 1441 })).toThrow()
    expect(() => firstRunDayBlocks({ startMin: 599.5, topic: 'X', endMin: 660 })).toThrow()
  })
})

describe('firstRunGhostWeek', () => {
  it('LaysTheSameDayOnEveryGivenDate', () => {
    const week = firstRunGhostWeek({ startMin: 540, topic: 'Sync', endMin: 720 }, [
      '2026-07-22',
      '2026-07-23',
    ])
    expect(week).toHaveLength(2)
    expect(week[0]?.date).toBe('2026-07-22')
    expect(week[0]?.blocks).toEqual(week[1]?.blocks)
  })

  it('NoRoom_MeansNoDaysAtAll', () => {
    expect(firstRunGhostWeek({ startMin: 540, topic: 'X', endMin: 555 }, ['2026-07-22'])).toEqual(
      [],
    )
  })
})

describe('firstRunPlannableDates', () => {
  const week = [
    '2026-07-20', // Mon
    '2026-07-21',
    '2026-07-22',
    '2026-07-23',
    '2026-07-24', // Fri
    '2026-07-25', // Sat
    '2026-07-26', // Sun
  ]

  it('MidWeek_KeepsTodayAndTheRemainingWeekdays_NeverThePast', () => {
    expect(firstRunPlannableDates(week, '2026-07-22')).toEqual([
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
    ])
  })

  it('Monday_PlansTheWholeWorkWeek_WeekendColumnsNever', () => {
    expect(firstRunPlannableDates(week, '2026-07-20')).toEqual(week.slice(0, 5))
  })

  it('Weekend_LeavesNothingToPlanInThisWeek', () => {
    expect(firstRunPlannableDates(week, '2026-07-25')).toEqual([])
  })
})
