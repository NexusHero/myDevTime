import { describe, expect, it } from 'vitest'
import { occurrencesToBlocks } from './recurring.js'
import type { Occurrence } from '../api/recurrence.js'

/**
 * Placing recurring occurrences on the Planner week canvas (design v17 §F4): each lands on its
 * day column with its minute-of-day converted to the canvas offset from START_HOUR, always with
 * `rec: true`. Occurrences off the shown week are dropped.
 */
const WEEK = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10']

function occ(over: Partial<Occurrence>): Occurrence {
  return {
    seriesId: 's1',
    kind: 'focus',
    title: 'Standup',
    date: '2026-07-06',
    startMin: 540, // 09:00
    lenMin: 30,
    projectId: null,
    ...over,
  }
}

describe('occurrencesToBlocks', () => {
  it('PlacesOnTheDayColumnWithOffsetFromStartHour', () => {
    const [b] = occurrencesToBlocks([occ({})], WEEK)
    expect(b).toMatchObject({
      day: 0,
      start: 60,
      len: 30,
      label: 'Standup',
      rec: true,
      seriesId: 's1',
    })
    // focus → the canvas 'actual' (fixed planned) kind.
    expect(b?.kind).toBe('actual')
  })

  it('MapsKindsAndCarriesTheProject', () => {
    const [b] = occurrencesToBlocks([occ({ kind: 'meeting', projectId: 'p9' })], WEEK)
    expect(b?.kind).toBe('meeting')
    expect(b?.project).toBe('p9')
  })

  it('OmitsTheProjectWhenNull', () => {
    const [b] = occurrencesToBlocks([occ({})], WEEK)
    expect(b && 'project' in b).toBe(false)
  })

  it('DropsOccurrencesOutsideTheShownWeek', () => {
    expect(occurrencesToBlocks([occ({ date: '2026-07-20' })], WEEK)).toEqual([])
  })

  it('ClampsAStartBeforeTheCanvasDayToTheTop', () => {
    // 07:30 is before the 08:00 canvas start → clamped to 0.
    const [b] = occurrencesToBlocks([occ({ startMin: 450 })], WEEK)
    expect(b?.start).toBe(0)
  })
})
