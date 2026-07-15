import { useEffect, useState } from 'react'
import { focusStreak, workloadLoad, type Load } from '@mydevtime/domain'
import { apiBaseUrl } from '../config.js'
import { fetchSummary } from '../api/reports.js'
import { listAbsences } from '../api/absences.js'
import { fetchWorktimeSummary } from '../api/worktime.js'
import {
  absenceDateSet,
  buildDayFocus,
  focusMinutesByDate,
  lastNDates,
  weekStartIso,
  weekToDateMinutes,
} from '../insights/insights.js'

/** How far back the streak looks; the run rarely exceeds this and the query stays cheap. */
const WINDOW_DAYS = 21
/** A day extends the focus streak at ≥ 2 h tracked (design "Serie ≥ 2h Fokus"). */
const FOCUS_THRESHOLD_MIN = 120

export interface Insights {
  /** Consecutive-day focus streak (absence-bridged, F17). */
  readonly streak: number
  /** Neutral workload level for the week-to-date vs the target schedule. */
  readonly load: Load
}

export interface InsightsResource {
  readonly data: Insights | null
  readonly loading: boolean
}

/** Today as `YYYY-MM-DD` in the given timezone. */
function todayIso(tz: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
}

/**
 * Live Balance & Streak signals for the Today header (REQ-032). Composes the
 * existing summary / absence / worktime read models on the client and runs the
 * **deterministic** `focusStreak` + `workloadLoad` (ADR-0005) — the numbers are the
 * core's, never fabricated. Returns null until data is available (idle header).
 */
export function useInsights(): InsightsResource {
  const base = apiBaseUrl
  const [data, setData] = useState<Insights | null>(null)
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
      // Target is schedule-based; a user with no schedule just gets an unknown target.
      fetchWorktimeSummary(base, { from: monday, to, tz }).catch(() => null),
    ])
      .then(([summary, absences, worktime]) => {
        if (!alive) return
        const focusByDate = focusMinutesByDate(summary)
        const streak = focusStreak(buildDayFocus(dates, focusByDate, absenceDateSet(absences)), {
          thresholdMin: FOCUS_THRESHOLD_MIN,
        })
        const load = workloadLoad({
          actualMin: weekToDateMinutes(focusByDate, today),
          targetMin: worktime ? Math.round(worktime.targetMs / 60_000) : 0,
        })
        setData({ streak, load })
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

  return { data, loading }
}
