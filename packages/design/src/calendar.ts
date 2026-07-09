/**
 * Calendar geometry (ux-vision §3, issue #37) — the pure month-grid math behind
 * the absence calendar, kept here (pure + tested) so the screen stays declarative
 * and the grid is deterministic given a year + month (ADR-0005), like the planner
 * and instrument helpers. No React/RN; the numbers a cell shows are computed once
 * and consumed identically on native and web.
 */

/** One cell of a month grid. `inMonth` is false for the leading/trailing spill days. */
export interface DayCell {
  /** Day-of-month number shown in the cell (1–31). */
  readonly date: number
  /** True for days of the grid's own month, false for adjacent-month spill. */
  readonly inMonth: boolean
}

/** Number of days in a given month (`month0` is 0-based: 0 = January). */
export function daysInMonth(year: number, month0: number): number {
  if (month0 < 0 || month0 > 11) throw new Error('month0 must be 0–11')
  // Day 0 of the next month is the last day of this month.
  return new Date(year, month0 + 1, 0).getDate()
}

/**
 * A fixed 6×7 month grid (six weeks, always) for `month0` of `year`. Leading
 * cells spill from the previous month and trailing cells from the next, both
 * flagged `inMonth: false`, so the screen renders a stable rectangle and marks
 * only its own days. `weekStartsMonday` picks the column order (Mon-first vs
 * Sun-first) — the user's "week starts Monday" preference.
 */
export function monthGrid(year: number, month0: number, weekStartsMonday = true): DayCell[][] {
  if (month0 < 0 || month0 > 11) throw new Error('month0 must be 0–11')
  const firstDow = new Date(year, month0, 1).getDay() // 0 = Sunday … 6 = Saturday
  const lead = weekStartsMonday ? (firstDow + 6) % 7 : firstDow
  const dim = daysInMonth(year, month0)
  const prevMonth = (month0 + 11) % 12
  const prevDim = daysInMonth(month0 === 0 ? year - 1 : year, prevMonth)

  const cells: DayCell[] = []
  for (let i = lead - 1; i >= 0; i--) cells.push({ date: prevDim - i, inMonth: false })
  for (let d = 1; d <= dim; d++) cells.push({ date: d, inMonth: true })
  let next = 1
  while (cells.length < 42) cells.push({ date: next++, inMonth: false })

  const weeks: DayCell[][] = []
  for (let i = 0; i < 42; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Weekday column headers in the grid's order (two-letter, English). */
export function weekdayHeaders(weekStartsMonday = true): readonly string[] {
  return weekStartsMonday
    ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
}
