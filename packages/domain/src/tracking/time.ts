/**
 * Timezone/DST-safe time primitives for the deterministic tracking core
 * (ADR-0005, REQ-003). No I/O, no framework imports — only JS built-ins, which
 * are pure given their inputs: `Date.UTC` / `new Date(ms)` are deterministic
 * arithmetic, and `Intl.DateTimeFormat` reads the platform IANA timezone data.
 *
 * Instants are absolute (epoch ms, UTC). Durations are just `end - start`, which
 * is DST-independent. DST only matters when mapping an instant to a *local*
 * calendar day/week/month, which is what these helpers isolate.
 */

/** An absolute instant, milliseconds since the Unix epoch (UTC). */
export type Instant = number
/** A duration in milliseconds (>= 0 for a valid interval). */
export type DurationMs = number
/** An IANA timezone name, e.g. `'Europe/Berlin'`. */
export type TimeZone = string

export const MINUTE_MS = 60_000
export const HOUR_MS = 3_600_000
export const DAY_MS = 86_400_000

export interface LocalParts {
  /** Full year, e.g. 2026. */
  year: number
  /** Month 1-12. */
  month: number
  /** Day of month 1-31. */
  day: number
  /** Hour 0-23. */
  hour: number
  /** Minute 0-59. */
  minute: number
  /** Second 0-59. */
  second: number
}

const formatterCache = new Map<TimeZone, Intl.DateTimeFormat>()

function formatter(tz: TimeZone): Intl.DateTimeFormat {
  const cached = formatterCache.get(tz)
  if (cached) return cached
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  formatterCache.set(tz, fmt)
  return fmt
}

/** Wall-clock parts of `instant` in `tz` — DST-correct via the Intl tz data. */
export function localParts(instant: Instant, tz: TimeZone): LocalParts {
  const parts = formatter(tz).formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find(p => p.type === type)
    if (!found) throw new Error(`Intl did not return part "${type}" for ${tz}`)
    return Number(found.value)
  }
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

function floorToSecond(instant: Instant): Instant {
  return instant - (((instant % 1000) + 1000) % 1000)
}

/**
 * Offset in ms to add to UTC to get `tz` wall-clock time at `instant`
 * (e.g. +3600000 for CET, +7200000 for CEST). Minute-aligned.
 */
export function tzOffsetMs(instant: Instant, tz: TimeZone): number {
  const p = localParts(instant, tz)
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asIfUtc - floorToSecond(instant)
}

/**
 * The instant at which the given wall-clock time occurs in `tz`. Inverse of
 * `localParts`. Two-pass so it settles across DST transitions (the offset before
 * and after the guess can differ).
 */
export function zonedTimeToInstant(parts: LocalParts, tz: TimeZone): Instant {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  const offset1 = tzOffsetMs(utcGuess, tz)
  const candidate = utcGuess - offset1
  const offset2 = tzOffsetMs(candidate, tz)
  return offset2 === offset1 ? candidate : utcGuess - offset2
}

/** The instant of 00:00:00 local, on the same local day as `instant`. */
export function startOfLocalDay(instant: Instant, tz: TimeZone): Instant {
  const p = localParts(instant, tz)
  return zonedTimeToInstant(
    { year: p.year, month: p.month, day: p.day, hour: 0, minute: 0, second: 0 },
    tz,
  )
}

/** The instant of the start of the next local day after `instant`'s day. */
export function startOfNextLocalDay(instant: Instant, tz: TimeZone): Instant {
  // Cross the day with +26h (covers 23h/25h DST days), then snap to midnight.
  return startOfLocalDay(startOfLocalDay(instant, tz) + 26 * HOUR_MS, tz)
}

/** ISO weekday for a Gregorian date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(year: number, month: number, day: number): number {
  const wd = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0 = Sun
  return wd === 0 ? 7 : wd
}

/**
 * The instant of the start of the local week containing `instant`.
 * `weekStartsOn`: 1 = Monday (ISO default) … 7 = Sunday.
 */
export function startOfLocalWeek(instant: Instant, tz: TimeZone, weekStartsOn = 1): Instant {
  const p = localParts(instant, tz)
  const wd = isoWeekday(p.year, p.month, p.day)
  const back = (wd - weekStartsOn + 7) % 7
  const midnight = startOfLocalDay(instant, tz)
  // Step back `back` local days, snapping each time to absorb DST.
  let cursor = midnight
  for (let i = 0; i < back; i++) {
    cursor = startOfLocalDay(cursor - 2 * HOUR_MS, tz)
  }
  return cursor
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** `YYYY-MM-DD` local day key. */
export function dayKey(instant: Instant, tz: TimeZone): string {
  const p = localParts(instant, tz)
  return `${String(p.year).padStart(4, '0')}-${pad(p.month)}-${pad(p.day)}`
}

/** `YYYY-MM` local month key. */
export function monthKey(instant: Instant, tz: TimeZone): string {
  const p = localParts(instant, tz)
  return `${String(p.year).padStart(4, '0')}-${pad(p.month)}`
}

/** Week key: the `YYYY-MM-DD` of the week's start day (unambiguous across years). */
export function weekKey(instant: Instant, tz: TimeZone, weekStartsOn = 1): string {
  return dayKey(startOfLocalWeek(instant, tz, weekStartsOn), tz)
}
