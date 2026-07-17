import { dayLoad, type Priority } from '@mydevtime/design'
import type { Occurrence } from '../api/recurrence'

/**
 * Pure month/year aggregation for the Planner calendar facet (design v18 PlannerViews). The
 * ground law of both views: **tasks** (planned work) count toward the day's load and carry a
 * project color + priority; **events** (holiday, company event, info) never count and never block
 * — they surface as a hollow flag banner. This module shapes the real occurrence + event data
 * into per-day and per-month buckets the `PlannerMonth`/`PlannerYear` components render; the load
 * math is the deterministic `dayLoad` from `@mydevtime/design` (ADR-0005). No mock data: an empty
 * input yields empty buckets, and the screen shows an honest empty calendar.
 */

/** A planned task in a calendar cell — its priority, estimate, label and project (for the color). */
export interface DayTask {
  readonly prio: Priority
  readonly estHours: number
  readonly label: string
  readonly projectId: string | null
}

/** A non-counting event in a calendar cell (holiday / company event / absence). */
export interface DayEvent {
  readonly label: string
}

/** The shaped contents of one calendar day. */
export interface MonthDay {
  readonly tasks: readonly DayTask[]
  readonly events: readonly DayEvent[]
  /** Priority-weighted hours (the "Schwere" bar) — tasks only, events never count. */
  readonly load: number
}

/** A calendar event keyed to a `YYYY-MM-DD` day (absence, holiday). */
export interface CalendarEvent {
  readonly date: string
  readonly label: string
}

/** Occurrences carry no priority; a projected series is medium priority by default (never invented). */
const DEFAULT_PRIO: Priority = 2

/** Day-of-month (1–31) from a `YYYY-MM-DD` string, or null if it is not in `year`/`month0`. */
function dayInMonth(date: string, year: number, month0: number): number | null {
  const [y, m, d] = date.split('-').map(s => Number.parseInt(s, 10))
  if (y !== year || m !== month0 + 1 || !d || Number.isNaN(d)) return null
  return d
}

/**
 * Bucket a month's occurrences (tasks) and events into per-day contents. Occurrences map to tasks
 * (estimate = `lenMin`/60, project color from `projectId`); events map straight through. Keyed by
 * day-of-month so the grid renders directly. Deterministic: same input → same buckets.
 */
export function buildMonthDays(
  occurrences: readonly Occurrence[],
  events: readonly CalendarEvent[],
  opts: { readonly year: number; readonly month0: number },
): Map<number, MonthDay> {
  const tasksByDay = new Map<number, DayTask[]>()
  for (const occ of occurrences) {
    const day = dayInMonth(occ.date, opts.year, opts.month0)
    if (day === null) continue
    const list = tasksByDay.get(day) ?? []
    list.push({
      prio: DEFAULT_PRIO,
      estHours: occ.lenMin / 60,
      label: occ.title,
      projectId: occ.projectId ?? null,
    })
    tasksByDay.set(day, list)
  }

  const eventsByDay = new Map<number, DayEvent[]>()
  for (const ev of events) {
    const day = dayInMonth(ev.date, opts.year, opts.month0)
    if (day === null) continue
    const list = eventsByDay.get(day) ?? []
    list.push({ label: ev.label })
    eventsByDay.set(day, list)
  }

  const out = new Map<number, MonthDay>()
  const days = new Set<number>([...tasksByDay.keys(), ...eventsByDay.keys()])
  for (const day of days) {
    const tasks = tasksByDay.get(day) ?? []
    out.set(day, {
      tasks,
      events: eventsByDay.get(day) ?? [],
      load: dayLoad(tasks.map(t => ({ prio: t.prio, estHours: t.estHours }))),
    })
  }
  return out
}

/** One month cell of the year view. */
export interface YearMonth {
  readonly month0: number
  readonly name: string
  /** Planned hours this month (Σ occurrence lengths) — `0` renders as an em-dash. */
  readonly hours: number
  /** Five week-intensity levels 0–3 (idle → heavy), one per calendar week row. */
  readonly weekLoads: readonly number[]
  readonly eventCount: number
  readonly isNow: boolean
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** Map a priority-weighted week load to a 0–3 intensity level vs. the weekly target. */
function weekIntensity(load: number, weeklyTarget: number): number {
  if (!(load > 0)) return 0
  const r = load / weeklyTarget
  if (r <= 0.4) return 1
  if (r <= 0.8) return 2
  return 3
}

/**
 * Aggregate a year's occurrences + events into 12 month cells: planned hours, a 5-row week-intensity
 * strip, and an event count, with the current month flagged. Weeks are bucketed by ISO day → week
 * index within the month (0–4). Deterministic; empty months read as `0` hours / all-idle.
 */
export function buildYearMonths(
  occurrences: readonly Occurrence[],
  events: readonly CalendarEvent[],
  opts: { readonly year: number; readonly nowMonth0: number; readonly weeklyTargetHours?: number },
): YearMonth[] {
  const weeklyTarget = opts.weeklyTargetHours ?? 40
  const hoursByMonth = new Array<number>(12).fill(0)
  const weekLoadByMonth = Array.from({ length: 12 }, () => new Array<number>(5).fill(0))
  const eventsByMonth = new Array<number>(12).fill(0)

  for (const occ of occurrences) {
    const [y, m, d] = occ.date.split('-').map(s => Number.parseInt(s, 10))
    if (y !== opts.year || !m || !d) continue
    const month0 = m - 1
    hoursByMonth[month0] = (hoursByMonth[month0] ?? 0) + occ.lenMin / 60
    const weekRow = Math.min(4, Math.floor((d - 1) / 7))
    const row = weekLoadByMonth[month0]
    if (row) row[weekRow] = (row[weekRow] ?? 0) + (occ.lenMin / 60) * 1.0
  }
  for (const ev of events) {
    const [y, m] = ev.date.split('-').map(s => Number.parseInt(s, 10))
    if (y !== opts.year || !m) continue
    eventsByMonth[m - 1] = (eventsByMonth[m - 1] ?? 0) + 1
  }

  return MONTH_NAMES.map((name, month0) => ({
    month0,
    name,
    hours: Math.round(hoursByMonth[month0] ?? 0),
    weekLoads: (weekLoadByMonth[month0] ?? []).map(l => weekIntensity(l, weeklyTarget)),
    eventCount: eventsByMonth[month0] ?? 0,
    isNow: month0 === opts.nowMonth0,
  }))
}
