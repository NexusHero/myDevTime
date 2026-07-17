import { describe, expect, it } from 'vitest'
import { toSeriesProposals, type ExtractedLesson } from './schedule.js'

// A Monday, UTC midnight (2026-07-06 is a Monday → isoWeekday 1).
const MON = Date.parse('2026-07-06T00:00:00Z')

const lesson = (over: Partial<ExtractedLesson> = {}): ExtractedLesson => ({
  title: 'Mathematics',
  weekday: 3, // Wednesday
  startMin: 8 * 60,
  lenMin: 45,
  ...over,
})

describe('toSeriesProposals', () => {
  it('ShapesALessonIntoAWeeklySeriesProposal_neverBooked', () => {
    const [p] = toSeriesProposals([lesson()], MON)
    expect(p).toEqual({
      title: 'Mathematics',
      anchorDate: '2026-07-08', // the Wednesday of that week
      startMin: 480,
      lenMin: 45,
      rule: { freq: 'weekly', end: { kind: 'never' } },
      source: 'ai-proposal',
      confirmed: false,
    })
  })

  it('AnchorsOnTheReferenceDayWhenWeekdayMatches', () => {
    const [p] = toSeriesProposals([lesson({ weekday: 1 })], MON)
    expect(p?.anchorDate).toBe('2026-07-06') // the Monday itself, offset 0
  })

  it('AnchorsToNextWeekWhenWeekdayAlreadyPassed', () => {
    // Reference is Wednesday; a Monday lesson lands on next Monday.
    const WED = Date.parse('2026-07-08T00:00:00Z')
    const [p] = toSeriesProposals([lesson({ weekday: 1 })], WED)
    expect(p?.anchorDate).toBe('2026-07-13')
  })

  it('CarriesAiProposalProvenance_andIsNeverConfirmed', () => {
    const [p] = toSeriesProposals([lesson()], MON)
    expect(p?.source).toBe('ai-proposal')
    expect(p?.confirmed).toBe(false)
  })

  it('DropsInvalidLessons_neverGuesses', () => {
    const bad: ExtractedLesson[] = [
      lesson({ title: '   ' }), // empty title
      lesson({ weekday: 0 }), // out of range
      lesson({ weekday: 8 }),
      lesson({ startMin: -1 }),
      lesson({ lenMin: 0 }),
      lesson({ startMin: 1400, lenMin: 120 }), // runs past midnight
    ]
    expect(toSeriesProposals(bad, MON)).toEqual([])
  })

  it('KeepsInputOrderForValidLessons', () => {
    const ps = toSeriesProposals([lesson({ title: 'A' }), lesson({ title: 'B' })], MON)
    expect(ps.map(p => p.title)).toEqual(['A', 'B'])
  })

  it('EmptyInput_IsEmpty', () => {
    expect(toSeriesProposals([], MON)).toEqual([])
  })
})
