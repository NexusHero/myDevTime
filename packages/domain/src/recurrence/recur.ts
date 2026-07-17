/**
 * Recurring entries (REQ-060, design v17 §F4) — pure and deterministic (ADR-0005). Series are
 * a **core** feature for *every* entry type (a daily standup, a weekday commute, football on
 * Tuesdays), not a family extra. A rule is a frequency plus an end; `expandRecurrence` lists
 * the occurrence dates within a window, and editing "this vs the series from here" splits the
 * series the Outlook way (`truncateBefore`). Date-only arithmetic on `YYYY-MM-DD` strings —
 * no clock, no timezone (a calendar day is the unit here).
 */

/** `daily` means **every weekday** (Mon–Fri), matching the §F4 "täglich (werktags)" option. */
export type RecurrenceFreq = 'none' | 'daily' | 'weekly' | 'monthly'

export type RecurrenceEnd =
  | { readonly kind: 'never' }
  /** Inclusive last date the series may land on, `YYYY-MM-DD`. */
  | { readonly kind: 'until'; readonly date: string }
  /** Total number of occurrences, including the first. */
  | { readonly kind: 'count'; readonly count: number }

export interface RecurrenceRule {
  readonly freq: RecurrenceFreq
  readonly end: RecurrenceEnd
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
/** A hard cap on expansion steps, so a huge window can never loop unbounded. */
const MAX_STEPS = 4000

interface Ymd {
  readonly y: number
  readonly m: number // 1..12
  readonly d: number // 1..31
}

function parse(date: string): Ymd {
  const match = DATE_RE.exec(date)
  if (match === null) throw new Error(`invalid date: ${date}`)
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const utc = Date.UTC(y, m - 1, d)
  const back = new Date(utc)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() + 1 !== m || back.getUTCDate() !== d) {
    throw new Error(`invalid date: ${date}`)
  }
  return { y, m, d }
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

function format({ y, m, d }: Ymd): string {
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`
}

function toMs({ y, m, d }: Ymd): number {
  return Date.UTC(y, m - 1, d)
}

/** Weekday 0..6 (Sun..Sat) for a date. */
function weekday(ymd: Ymd): number {
  return new Date(toMs(ymd)).getUTCDay()
}

function addDays(ymd: Ymd, days: number): Ymd {
  const next = new Date(toMs(ymd) + days * 86_400_000)
  return { y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() }
}

/** The nth calendar month after `ymd`, keeping the day-of-month; `null` if that month is short. */
function addMonthsKeepingDay(ymd: Ymd, months: number): Ymd | null {
  const total = ymd.y * 12 + (ymd.m - 1) + months
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  const utc = Date.UTC(y, m - 1, ymd.d)
  const back = new Date(utc)
  // A short month (e.g. Feb 31) overflows into the next month → skip, never clamp/drift.
  if (back.getUTCMonth() + 1 !== m) return null
  return { y, m, d: ymd.d }
}

/** The next occurrence strictly after `current`, or `null` when the frequency does not repeat. */
function step(freq: RecurrenceFreq, start: Ymd, current: Ymd): Ymd | null {
  switch (freq) {
    case 'none':
      return null
    case 'daily': {
      let next = addDays(current, 1)
      while (weekday(next) === 0 || weekday(next) === 6) next = addDays(next, 1)
      return next
    }
    case 'weekly':
      return addDays(current, 7)
    case 'monthly': {
      // Advance whole months from the START day so a skipped short month never shifts the day.
      let n = current.y * 12 + (current.m - 1) - (start.y * 12 + (start.m - 1)) + 1
      for (let guard = 0; guard < 12 * 8; guard += 1, n += 1) {
        const candidate = addMonthsKeepingDay(start, n)
        if (candidate !== null) return candidate
      }
      return null
    }
  }
}

/** True when `daily` would place the start itself on a weekend (then it has no valid dates). */
function startIsValid(freq: RecurrenceFreq, start: Ymd): boolean {
  if (freq !== 'daily') return true
  const wd = weekday(start)
  return wd !== 0 && wd !== 6
}

/**
 * The occurrence dates of a series within `[windowFrom, windowTo]` (inclusive), in order.
 * Respects the rule's end (never / until / count). Pure date math, capped at `MAX_STEPS`.
 */
export function expandRecurrence(
  rule: RecurrenceRule,
  startDate: string,
  windowFrom: string,
  windowTo: string,
): string[] {
  const start = parse(startDate)
  const fromMs = toMs(parse(windowFrom))
  const toWindowMs = toMs(parse(windowTo))
  const untilMs = rule.end.kind === 'until' ? toMs(parse(rule.end.date)) : Infinity
  const maxCount = rule.end.kind === 'count' ? Math.max(0, rule.end.count) : Infinity

  const out: string[] = []
  let emitted = 0
  let current: Ymd | null = startIsValid(rule.freq, start) ? start : step(rule.freq, start, start)

  for (let i = 0; i < MAX_STEPS && current !== null; i += 1) {
    if (emitted >= maxCount) break
    const ms = toMs(current)
    if (ms > untilMs || ms > toWindowMs) break
    emitted += 1
    if (ms >= fromMs) out.push(format(current))
    current = step(rule.freq, start, current)
  }
  return out
}

/** Whether the series lands on `date` (within a generous forward window from the start). */
export function isOccurrence(rule: RecurrenceRule, startDate: string, date: string): boolean {
  return expandRecurrence(rule, startDate, startDate, date).includes(date)
}

/**
 * Split a series for a "this and everything after" edit: end the *original* series the day
 * before `date` (Outlook convention). The caller starts a fresh series at `date` for the edit.
 */
export function truncateBefore(rule: RecurrenceRule, date: string): RecurrenceRule {
  const dayBefore = format(addDays(parse(date), -1))
  return { freq: rule.freq, end: { kind: 'until', date: dayBefore } }
}

const FREQ_LABEL: Record<RecurrenceFreq, string> = {
  none: 'Does not repeat',
  daily: 'Every weekday',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

/** A plain-English label for the drawer's ↻ row, e.g. `Weekly, 6 times`. */
export function describeRecurrence(rule: RecurrenceRule): string {
  const base = FREQ_LABEL[rule.freq]
  if (rule.freq === 'none') return base
  if (rule.end.kind === 'count') return `${base}, ${String(rule.end.count)} times`
  if (rule.end.kind === 'until') return `${base}, until ${rule.end.date}`
  return base
}
