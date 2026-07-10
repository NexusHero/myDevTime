import { getJson, postJson } from './http.js'
import { num, nullableStr, parseArray, record, str } from './parse.js'

/**
 * The absences read model for the client (REQ-029): parse leave ranges and the
 * vacation balance the NestJS `absences` module computes, and derive the month's
 * calendar marks + the upcoming list. Dates are plain `YYYY-MM-DD` calendar days,
 * so range checks are exact lexicographic string comparisons. The balance numbers
 * are the deterministic core's (ADR-0005); the client only parses and formats.
 */
export type AbsenceKind = 'vacation' | 'sick' | 'holiday' | 'other'

export interface Absence {
  readonly id: string
  readonly kind: AbsenceKind
  readonly startDate: string
  readonly endDate: string
  readonly halfDay: boolean
  readonly note: string | null
}

const KINDS: readonly AbsenceKind[] = ['vacation', 'sick', 'holiday', 'other']

export function parseAbsence(value: unknown): Absence {
  const o = record(value)
  const kind = str(o, 'kind')
  return {
    id: str(o, 'id'),
    kind: (KINDS as readonly string[]).includes(kind) ? (kind as AbsenceKind) : 'other',
    startDate: str(o, 'startDate'),
    endDate: str(o, 'endDate'),
    halfDay: o.halfDay === true,
    note: nullableStr(o, 'note'),
  }
}

export interface VacationBalance {
  readonly allowanceDays: number
  readonly carryOverDays: number
  readonly usedDays: number
  readonly remainingDays: number
}

export function parseBalance(value: unknown): VacationBalance {
  const o = record(value)
  return {
    allowanceDays: num(o, 'allowanceDays'),
    carryOverDays: num(o, 'carryOverDays'),
    usedDays: num(o, 'usedDays'),
    remainingDays: num(o, 'remainingDays'),
  }
}

/** List absences overlapping `[from, to]` (inclusive `YYYY-MM-DD` dates). */
export async function listAbsences(
  baseUrl: string,
  range: { from: string; to: string },
  fetchImpl: typeof fetch = fetch,
): Promise<Absence[]> {
  const qs = new URLSearchParams({ from: range.from, to: range.to }).toString()
  return parseArray(await getJson(baseUrl, `/api/absences?${qs}`, fetchImpl), parseAbsence)
}

/** The vacation-allowance balance for a calendar year. */
export async function fetchBalance(
  baseUrl: string,
  year: number,
  fetchImpl: typeof fetch = fetch,
): Promise<VacationBalance> {
  return parseBalance(
    await getJson(baseUrl, `/api/absences/balance?year=${String(year)}`, fetchImpl),
  )
}

/** Create an absence; returns the stored row. */
export async function createAbsence(
  baseUrl: string,
  input: { kind: AbsenceKind; startDate: string; endDate: string; halfDay?: boolean },
  fetchImpl: typeof fetch = fetch,
): Promise<Absence> {
  return parseAbsence(await postJson(baseUrl, '/api/absences', input, fetchImpl))
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** Marks each day-of-month covered by an absence with its kind (first match wins). */
export function monthMarks(
  list: readonly Absence[],
  year: number,
  month0: number,
): Record<number, AbsenceKind> {
  const marks: Record<number, AbsenceKind> = {}
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
  const mm = pad(month0 + 1)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${String(year)}-${mm}-${pad(d)}`
    for (const a of list) {
      if (key >= a.startDate && key <= a.endDate) {
        marks[d] = a.kind
        break
      }
    }
  }
  return marks
}

/** Absences still current or in the future (by end date), earliest first. */
export function upcomingAbsences(list: readonly Absence[], todayIso: string, limit = 5): Absence[] {
  return list
    .filter(a => a.endDate >= todayIso)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, limit)
}
