import { describe, expect, it } from 'vitest'
import { easterSunday, holidaysForRegion, HOLIDAY_REGIONS } from './holidays.js'

describe('easterSunday', () => {
  it.each([
    [2024, 3, 31],
    [2025, 4, 20],
    [2026, 4, 5],
    [2027, 3, 28],
  ])('Year%i_MatchesKnownEasterSunday', (year, month, day) => {
    expect(easterSunday(year)).toEqual({ month, day })
  })
})

describe('holidaysForRegion', () => {
  it('DE2026_HasTheNineFederalHolidays', () => {
    expect(holidaysForRegion('DE', 2026)).toEqual([
      '2026-01-01', // Neujahr
      '2026-04-03', // Karfreitag
      '2026-04-06', // Ostermontag
      '2026-05-01', // Tag der Arbeit
      '2026-05-14', // Christi Himmelfahrt
      '2026-05-25', // Pfingstmontag
      '2026-10-03', // Deutsche Einheit
      '2026-12-25',
      '2026-12-26',
    ])
  })

  it('BadenWuerttemberg_AddsEpiphanyCorpusChristiAllSaints', () => {
    const de = new Set(holidaysForRegion('DE', 2026))
    const bw = holidaysForRegion('DE-BW', 2026)
    const extra = bw.filter(d => !de.has(d))
    expect(extra).toEqual(['2026-01-06', '2026-06-04', '2026-11-01']) // sorted
  })

  it('CHFederal_IsJustTheThreeNearUniversalDays', () => {
    expect(holidaysForRegion('CH', 2026)).toEqual(['2026-01-01', '2026-08-01', '2026-12-25'])
  })

  it('BaselStadt_ObservesTheCommonChristianFeasts', () => {
    const bs = holidaysForRegion('CH-BS', 2026)
    expect(bs).toContain('2026-04-03') // Karfreitag
    expect(bs).toContain('2026-05-14') // Auffahrt
    expect(bs).toContain('2026-08-01') // Bundesfeier
    expect(bs).toContain('2026-12-26') // Stephanstag
    expect(bs).not.toContain('2026-10-03') // not a Swiss holiday
  })

  it('IsSortedUniqueAndDeterministic', () => {
    for (const region of HOLIDAY_REGIONS) {
      const a = holidaysForRegion(region, 2026)
      const b = holidaysForRegion(region, 2026)
      expect(a).toEqual(b) // deterministic
      expect([...a].sort()).toEqual(a) // sorted
      expect(new Set(a).size).toBe(a.length) // unique
    }
  })
})
