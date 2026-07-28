/**
 * The Day view's date header (issue #381). On the Day stage there is exactly one day, so the
 * screen should say which one plainly — the way a calendar does, rather than reusing the small
 * column label the week grid needs. Pure and locale-driven: the month name is never hard-coded,
 * and the same instant always names the same calendar day (ADR-0005).
 */

export interface DayHeading {
  /** The full date in the caller's locale, e.g. `July 27, 2026`. */
  readonly date: string
  /** The weekday, spelled out, e.g. `Monday`. */
  readonly weekday: string
  /**
   * The day-of-month on its own, e.g. `27`. Split out as *data* so the view can set it heavier
   * than the rest of the date without parsing the formatted string back apart.
   */
  readonly dayNumber: string
}

/**
 * Name the calendar day `ms` falls on. `locale` defaults to the runtime's, so the header speaks
 * the user's language without a translation table.
 */
export function dayHeading(ms: number, locale?: string): DayHeading {
  const d = new Date(ms)
  return {
    date: d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }),
    weekday: d.toLocaleDateString(locale, { weekday: 'long' }),
    dayNumber: String(d.getDate()),
  }
}
