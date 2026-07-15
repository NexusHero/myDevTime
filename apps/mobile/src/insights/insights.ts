import type { DayFocus } from '@mydevtime/domain'
import type { Summary } from '../api/reports.js'
import type { Absence } from '../api/absences.js'

/**
 * Pure client-side composition for the Balance & Streak signals (REQ-032): turn the
 * existing summary/absence read models into the `DayFocus[]` the deterministic
 * `focusStreak` consumes, plus the week-to-date tracked total for `workloadLoad`.
 * No fetching, no clock — inputs in, values out — so it is unit-tested directly.
 */

const DAY_MS = 86_400_000

/** `YYYY-MM-DD` string of an epoch-day offset from a UTC-anchored date. */
function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** The last `n` calendar dates ending at `todayIso` (inclusive), ascending. */
export function lastNDates(todayIso: string, n: number): string[] {
  const base = Date.parse(`${todayIso}T00:00:00Z`)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) out.push(isoDay(base - i * DAY_MS))
  return out
}

/** Total tracked **minutes** per day, summed across projects (aligned to `summary.days`). */
export function focusMinutesByDate(summary: Summary): Map<string, number> {
  const map = new Map<string, number>()
  summary.days.forEach((date, i) => {
    let ms = 0
    for (const p of summary.byProject) ms += p.daily[i] ?? 0
    map.set(date, Math.round(ms / 60_000))
  })
  return map
}

/** Every calendar date covered by an absence (inclusive range), as `YYYY-MM-DD`. */
export function absenceDateSet(absences: readonly Absence[]): Set<string> {
  const set = new Set<string>()
  for (const a of absences) {
    let d = Date.parse(`${a.startDate}T00:00:00Z`)
    const end = Date.parse(`${a.endDate}T00:00:00Z`)
    if (Number.isNaN(d) || Number.isNaN(end)) continue
    // Cap the expansion so a malformed range can never spin forever.
    for (let guard = 0; d <= end && guard < 400; d += DAY_MS, guard += 1) set.add(isoDay(d))
  }
  return set
}

/** Assemble the ordered `DayFocus[]` for the streak from the composed inputs. */
export function buildDayFocus(
  dates: readonly string[],
  focusByDate: ReadonlyMap<string, number>,
  absences: ReadonlySet<string>,
): DayFocus[] {
  return dates.map(date => ({
    date,
    focusMin: focusByDate.get(date) ?? 0,
    absence: absences.has(date),
  }))
}

/** The Monday (ISO week start) of `todayIso`'s week, as `YYYY-MM-DD`. */
export function weekStartIso(todayIso: string): string {
  const today = Date.parse(`${todayIso}T00:00:00Z`)
  const daysSinceMonday = (new Date(today).getUTCDay() + 6) % 7 // 0 = Mon … 6 = Sun
  return isoDay(today - daysSinceMonday * DAY_MS)
}

/** Minutes tracked from this week's Monday through `todayIso` (inclusive). */
export function weekToDateMinutes(
  focusByDate: ReadonlyMap<string, number>,
  todayIso: string,
): number {
  const today = Date.parse(`${todayIso}T00:00:00Z`)
  const daysSinceMonday = (new Date(today).getUTCDay() + 6) % 7 // 0 = Mon … 6 = Sun
  let sum = 0
  for (let i = 0; i <= daysSinceMonday; i += 1) {
    sum += focusByDate.get(isoDay(today - (daysSinceMonday - i) * DAY_MS)) ?? 0
  }
  return sum
}
