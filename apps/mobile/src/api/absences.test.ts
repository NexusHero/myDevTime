import { describe, expect, it } from 'vitest'
import {
  fetchBalance,
  listAbsences,
  monthMarks,
  parseAbsence,
  parseBalance,
  upcomingAbsences,
  type Absence,
} from './absences.js'

/**
 * The absences client parses leave ranges + the vacation balance and derives the
 * month's calendar marks and the upcoming list. These pin the DTO parse, the
 * request paths, and the pure derivations (inclusive range marking + upcoming
 * filtering), which use lexicographic `YYYY-MM-DD` comparisons.
 */
const abs = (id: string, kind: Absence['kind'], startDate: string, endDate: string): Absence => ({
  id,
  kind,
  startDate,
  endDate,
  halfDay: false,
  note: null,
})

const A1 = {
  id: 'a1',
  kind: 'vacation',
  startDate: '2026-07-14',
  endDate: '2026-07-17',
  halfDay: false,
  note: null,
}
const BALANCE = { allowanceDays: 30, carryOverDays: 5, usedDays: 4.5, remainingDays: 30.5 }

describe('parseAbsence / parseBalance', () => {
  it('ReadsAnAbsenceRow', () => {
    const a = parseAbsence(A1)
    expect(a.kind).toBe('vacation')
    expect(a.endDate).toBe('2026-07-17')
  })
  it('FallsBackToOtherForAnUnknownKind', () => {
    expect(parseAbsence({ ...A1, kind: 'wat' }).kind).toBe('other')
  })
  it('ReadsTheBalance', () => {
    expect(parseBalance(BALANCE).remainingDays).toBe(30.5)
  })
  it('Malformed_Throws', () => {
    expect(() => parseBalance({ allowanceDays: 'x' })).toThrow()
  })
})

describe('requests', () => {
  const jsonFetch = (body: unknown, seen: string[]): typeof fetch =>
    ((url: string) => {
      seen.push(url)
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
    }) as unknown as typeof fetch
  it('ListsWithRangeQuery', async () => {
    const seen: string[] = []
    const list = await listAbsences(
      'http://api',
      { from: '2026-01-01', to: '2026-12-31' },
      jsonFetch([A1], seen),
    )
    expect(list[0]?.id).toBe('a1')
    expect(seen[0]).toContain('/api/absences?')
  })
  it('FetchesBalanceByYear', async () => {
    const seen: string[] = []
    const bal = await fetchBalance('http://api', 2026, jsonFetch(BALANCE, seen))
    expect(bal.usedDays).toBe(4.5)
    expect(seen[0]).toContain('/api/absences/balance?year=2026')
  })
})

describe('monthMarks', () => {
  it('MarksEveryCoveredDayInTheMonth', () => {
    const marks = monthMarks([abs('a1', 'vacation', '2026-07-14', '2026-07-17')], 2026, 6)
    expect(marks[13]).toBeUndefined()
    expect(marks[14]).toBe('vacation')
    expect(marks[17]).toBe('vacation')
    expect(marks[18]).toBeUndefined()
  })
  it('ClipsRangesThatSpillIntoOtherMonths', () => {
    const marks = monthMarks([abs('a2', 'sick', '2026-06-28', '2026-07-02')], 2026, 6)
    expect(marks[1]).toBe('sick')
    expect(marks[2]).toBe('sick')
    expect(marks[3]).toBeUndefined()
  })
})

describe('upcomingAbsences', () => {
  it('KeepsCurrentAndFutureSortedByStart', () => {
    const list = [
      abs('past', 'vacation', '2026-06-01', '2026-06-03'),
      abs('now', 'sick', '2026-07-09', '2026-07-11'),
      abs('later', 'holiday', '2026-07-29', '2026-07-29'),
    ]
    const up = upcomingAbsences(list, '2026-07-10')
    expect(up.map(a => a.id)).toEqual(['now', 'later'])
  })
})
