import { useEffect, useState } from 'react'
import { apiBaseUrl } from '../config.js'
import { fetchSummary } from '../api/reports.js'
import { listAbsences } from '../api/absences.js'
import { fetchWorktimeSummary } from '../api/worktime.js'
import {
  absenceDateSet,
  buildBalance,
  focusMinutesByDate,
  lastNDates,
  weekStartIso,
  type BalanceView,
} from '../insights/insights.js'

/** The Balance card looks back ten weeks — the trend sparkline's width. */
const WEEKS = 10
const WINDOW_DAYS = WEEKS * 7

export interface BalanceResource {
  readonly data: BalanceView | null
  readonly loading: boolean
  /** True when the data is API-backed (vs the empty demo/test default). */
  readonly live: boolean
}

/** Today as `YYYY-MM-DD` in the given timezone. */
function todayIso(tz: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
}

/**
 * The Balance card's live data source (REQ-032, design v10 §Balance): over the trailing
 * ten weeks it composes the workspace summary, absences and this week's work-time target
 * on the client, then runs the **deterministic** balance core (`buildBalance`) — the
 * neutral workload level, the weekly-focus trend and the day-length distribution. Every
 * number is the core's (ADR-0005); nothing is fabricated. With no API configured it
 * resolves **empty** (the view shows its honest empty state). The self-report check-in
 * is deliberately **not** here — it is local-only (`useCheckin`), never fetched.
 */
export function useBalance(): BalanceResource {
  const base = apiBaseUrl
  const [data, setData] = useState<BalanceView | null>(null)
  const [loading, setLoading] = useState(base !== null)

  useEffect(() => {
    if (base === null) {
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const today = todayIso(tz)
    const dates = lastNDates(today, WINDOW_DAYS)
    const from = dates[0] ?? today
    const to = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
    const monday = weekStartIso(today)

    Promise.all([
      fetchSummary(base, { from, to, tz }),
      listAbsences(base, { from, to }),
      // Target is schedule-based; no schedule → an unknown target (neutral, null ratio).
      fetchWorktimeSummary(base, { from: monday, to, tz }).catch(() => null),
    ])
      .then(([summary, absences, worktime]) => {
        if (!alive) return
        setData(
          buildBalance(
            dates,
            focusMinutesByDate(summary),
            absenceDateSet(absences),
            today,
            worktime ? Math.round(worktime.targetMs / 60_000) : 0,
            WEEKS,
          ),
        )
      })
      .catch(() => {
        if (alive) setData(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [base])

  return { data, loading, live: base !== null }
}
