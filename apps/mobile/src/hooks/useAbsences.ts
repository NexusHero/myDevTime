import { useEffect, useState } from 'react'
import { apiBaseUrl } from '../config.js'
import {
  fetchBalance,
  listAbsences,
  monthMarks,
  upcomingAbsences,
  type Absence,
  type AbsenceKind,
  type VacationBalance,
} from '../api/absences.js'
import { useLocalDb } from '../localDb/LocalDbProvider.js'
import { listAbsencesInRange } from '@mydevtime/local-db'

/**
 * The Absences data source (REQ-029). When an API base URL is configured the hook
 * loads the current month's absences and the year's vacation balance and derives
 * the calendar marks + upcoming list; otherwise — the default in local dev and the
 * test gate — it resolves illustrative demo figures. `live` lets the UI flag demo
 * data. The balance is the deterministic core's; the derivations are pure.
 */
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const pad = (n: number): string => String(n).padStart(2, '0')

export interface MonthInfo {
  readonly year: number
  readonly month0: number
  readonly label: string
  readonly today: number
}

export interface AbsencesData {
  readonly month: MonthInfo
  readonly marks: Record<number, AbsenceKind>
  readonly balance: VacationBalance
  readonly upcoming: readonly Absence[]
}

export interface AbsencesResource {
  readonly data: AbsencesData | null
  readonly loading: boolean
  readonly error: Error | null
  readonly live: boolean
}

function currentMonth(): MonthInfo {
  const now = new Date()
  const year = now.getFullYear()
  const month0 = now.getMonth()
  return { year, month0, label: `${MONTHS[month0] ?? ''} ${String(year)}`, today: now.getDate() }
}

export function useAbsences(): AbsencesResource {
  const base = apiBaseUrl
  const live = base !== null
  const db = useLocalDb()
  const [data, setData] = useState<AbsencesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const month = currentMonth()
    const mm = pad(month.month0 + 1)
    const lastDay = new Date(Date.UTC(month.year, month.month0 + 1, 0)).getUTCDate()
    const from = `${String(month.year)}-${mm}-01`
    const to = `${String(month.year)}-${mm}-${pad(lastDay)}`
    const todayIso = `${String(month.year)}-${mm}-${pad(month.today)}`

    const load: Promise<AbsencesData> =
      base === null
        ? listAbsencesInRange(db, from, to).then(list => ({
            month,
            marks: monthMarks(list as Absence[], month.year, month.month0),
            balance: { allowanceDays: 30, carryOverDays: 0, usedDays: 0, remainingDays: 30 },
            upcoming: upcomingAbsences(list as Absence[], todayIso),
          }))
        : Promise.all([listAbsences(base, { from, to }), fetchBalance(base, month.year)]).then(
            ([list, balance]) => ({
              month,
              marks: monthMarks(list, month.year, month.month0),
              balance,
              upcoming: upcomingAbsences(list, todayIso),
            }),
          )
    load
      .then(d => {
        if (!alive) return
        setData(d)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [base])

  return { data, loading, error, live }
}
