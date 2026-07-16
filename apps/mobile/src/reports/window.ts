/**
 * The report window (D-Reporting): the three ranges the Reports screen offers and the
 * pure `[from, to)` UTC window each resolves to, so the windowed summary/billing/worktime
 * endpoints can be queried for any of them. `week` keeps the existing trailing-7-day
 * semantics (ending at the next UTC midnight); `month` and `year` are the current UTC
 * **calendar** month/year — natural boundaries for a report labelled "Month"/"Year",
 * covering month- and year-to-date since entries only exist up to now. Pure and
 * `now`-injected so the math is deterministic and testable (ADR-0005 direction).
 */
export type ReportRange = 'week' | 'month' | 'year'

export interface ReportWindow {
  readonly from: string
  readonly to: string
  readonly tz: string
}

/** Human label for a range, used in card subtitles/tiles ("Worked · Month"). */
export function rangeLabel(range: ReportRange): string {
  if (range === 'month') return 'Month'
  if (range === 'year') return 'Year'
  return 'Week'
}

/** The `[from, to)` UTC window for a range at `now` (ISO strings, UTC timezone). */
export function reportWindow(range: ReportRange, now: Date): ReportWindow {
  const tz = 'UTC'
  if (range === 'month') {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
    return { from: from.toISOString(), to: to.toISOString(), tz }
  }
  if (range === 'year') {
    const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0))
    const to = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0))
    return { from: from.toISOString(), to: to.toISOString(), tz }
  }
  // Week: the trailing 7 days ending at the next UTC midnight (matches the prior behaviour).
  const to = new Date(now)
  to.setUTCHours(0, 0, 0, 0)
  to.setUTCDate(to.getUTCDate() + 1)
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 7)
  return { from: from.toISOString(), to: to.toISOString(), tz }
}
