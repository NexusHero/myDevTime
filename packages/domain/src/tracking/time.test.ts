import { describe, expect, it } from 'vitest'
import {
  HOUR_MS,
  dayKey,
  isoWeekday,
  localParts,
  monthKey,
  startOfLocalDay,
  startOfLocalWeek,
  startOfNextLocalDay,
  tzOffsetMs,
  weekKey,
  zonedTimeToInstant,
} from './time.js'

const BERLIN = 'Europe/Berlin'

describe('localParts', () => {
  it('LocalParts_WinterInstant_AppliesCetOffset', () => {
    const instant = Date.UTC(2026, 0, 15, 12, 0, 0)

    expect(localParts(instant, BERLIN)).toEqual({
      year: 2026,
      month: 1,
      day: 15,
      hour: 13,
      minute: 0,
      second: 0,
    })
  })

  it('LocalParts_SummerInstant_AppliesCestOffset', () => {
    const instant = Date.UTC(2026, 6, 15, 12, 0, 0)

    expect(localParts(instant, BERLIN)).toMatchObject({ hour: 14 })
  })

  it('LocalParts_UtcZone_MatchesUtcWallClock', () => {
    expect(localParts(Date.UTC(2026, 6, 15, 23, 59, 30), 'UTC')).toEqual({
      year: 2026,
      month: 7,
      day: 15,
      hour: 23,
      minute: 59,
      second: 30,
    })
  })
})

describe('tzOffsetMs', () => {
  it('TzOffset_Winter_IsPlusOneHour', () => {
    expect(tzOffsetMs(Date.UTC(2026, 0, 15, 12, 0, 0), BERLIN)).toBe(HOUR_MS)
  })

  it('TzOffset_Summer_IsPlusTwoHours', () => {
    expect(tzOffsetMs(Date.UTC(2026, 6, 15, 12, 0, 0), BERLIN)).toBe(2 * HOUR_MS)
  })
})

describe('zonedTimeToInstant', () => {
  it('ZonedTimeToInstant_RoundTrips_ThroughLocalParts', () => {
    const parts = { year: 2026, month: 7, day: 15, hour: 9, minute: 30, second: 0 }

    expect(localParts(zonedTimeToInstant(parts, BERLIN), BERLIN)).toEqual(parts)
  })

  it('ZonedTimeToInstant_Midnight_MatchesStartOfDay', () => {
    const midday = Date.UTC(2026, 6, 15, 10, 0, 0)
    const midnight = zonedTimeToInstant(
      { year: 2026, month: 7, day: 15, hour: 0, minute: 0, second: 0 },
      BERLIN,
    )

    expect(startOfLocalDay(midday, BERLIN)).toBe(midnight)
  })

  it('ZonedTimeToInstant_SpringForwardGap_ResolvesConsistently', () => {
    // 02:30 on 2026-03-29 does not exist in Berlin (clocks jump 02:00 -> 03:00);
    // the two-pass offset settles it to a real instant one hour on either side.
    const gap = zonedTimeToInstant(
      { year: 2026, month: 3, day: 29, hour: 2, minute: 30, second: 0 },
      BERLIN,
    )

    // localParts of the result is a real wall-clock time (03:30, the shifted slot).
    expect(localParts(gap, BERLIN)).toMatchObject({ hour: 3, minute: 30 })
  })
})

describe('startOfNextLocalDay (DST day lengths)', () => {
  it('NextLocalDay_SpringForwardDay_Is23Hours', () => {
    // 2026-03-29 Europe/Berlin loses an hour (02:00 -> 03:00).
    const during = zonedTimeToInstant(
      { year: 2026, month: 3, day: 29, hour: 12, minute: 0, second: 0 },
      BERLIN,
    )
    const start = startOfLocalDay(during, BERLIN)

    expect(startOfNextLocalDay(during, BERLIN) - start).toBe(23 * HOUR_MS)
  })

  it('NextLocalDay_FallBackDay_Is25Hours', () => {
    // 2026-10-25 Europe/Berlin gains an hour (03:00 -> 02:00).
    const during = zonedTimeToInstant(
      { year: 2026, month: 10, day: 25, hour: 12, minute: 0, second: 0 },
      BERLIN,
    )
    const start = startOfLocalDay(during, BERLIN)

    expect(startOfNextLocalDay(during, BERLIN) - start).toBe(25 * HOUR_MS)
  })

  it('NextLocalDay_OrdinaryDay_Is24Hours', () => {
    const during = Date.UTC(2026, 6, 15, 10, 0, 0)
    const start = startOfLocalDay(during, BERLIN)

    expect(startOfNextLocalDay(during, BERLIN) - start).toBe(24 * HOUR_MS)
  })
})

describe('isoWeekday', () => {
  it.each([
    [2026, 1, 1, 4], // Thursday
    [2026, 1, 5, 1], // Monday
    [2026, 1, 11, 7], // Sunday
  ])('IsoWeekday_%s-%s-%s_Is%s', (y, m, d, expected) => {
    expect(isoWeekday(y, m, d)).toBe(expected)
  })
})

describe('startOfLocalWeek', () => {
  it('StartOfLocalWeek_MondayStart_SnapsBackToMonday', () => {
    // 2026-07-15 is a Wednesday; Monday of that week is 2026-07-13.
    const wednesday = Date.UTC(2026, 6, 15, 10, 0, 0)

    expect(dayKey(startOfLocalWeek(wednesday, BERLIN, 1), BERLIN)).toBe('2026-07-13')
  })

  it('StartOfLocalWeek_SundayStart_SnapsBackToSunday', () => {
    const wednesday = Date.UTC(2026, 6, 15, 10, 0, 0)

    expect(dayKey(startOfLocalWeek(wednesday, BERLIN, 7), BERLIN)).toBe('2026-07-12')
  })

  it('StartOfLocalWeek_AcrossMonthBoundary_UsesEarlierMonth', () => {
    // 2026-08-01 is a Saturday; its ISO week starts Monday 2026-07-27.
    const saturday = Date.UTC(2026, 7, 1, 10, 0, 0)

    expect(weekKey(saturday, BERLIN, 1)).toBe('2026-07-27')
  })

  it('StartOfLocalWeek_OnWeekStartDay_ReturnsSameDay', () => {
    // 2026-07-13 is a Monday; with a Monday start there is nothing to step back.
    const monday = Date.UTC(2026, 6, 13, 10, 0, 0)

    expect(dayKey(startOfLocalWeek(monday, BERLIN), BERLIN)).toBe('2026-07-13')
  })
})

describe('keys', () => {
  it('DayKey_LateEveningUtc_UsesLocalDate', () => {
    // 23:30 UTC on 2026-07-15 is 01:30 next day in Berlin (CEST).
    expect(dayKey(Date.UTC(2026, 6, 15, 23, 30, 0), BERLIN)).toBe('2026-07-16')
  })

  it('MonthKey_FormatsYearMonth', () => {
    expect(monthKey(Date.UTC(2026, 6, 15, 10, 0, 0), BERLIN)).toBe('2026-07')
  })
})
