import { useEffect, useState } from 'react'
import { apiBaseUrl } from '../config.js'
import { fetchSummary } from '../api/reports.js'
import {
  dailyMinutesSeries,
  focusMinutesByDate,
  lastNDates,
  weekStartIso,
  type HeatCell,
} from '../insights/insights.js'

/** The heatmap spans twelve weeks — a season of habit, aligned to whole weeks. */
const WEEKS = 12
const DAYS = WEEKS * 7
const DAY_MS = 86_400_000

export interface HeatmapResource {
  readonly data: readonly HeatCell[] | null
  readonly loading: boolean
  readonly live: boolean
}

/** Today as `YYYY-MM-DD` in the given timezone. */
function todayIso(tz: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
}

/**
 * The Reports tracking heatmap data (REQ-005): twelve whole weeks of daily tracked
 * minutes, aligned so the grid starts on a Monday and ends on this week's Sunday — clean
 * week columns. Composes the windowed summary on the client and runs the pure
 * `dailyMinutesSeries` (ADR-0005) — real minutes per day, an honest all-zero grid when
 * nothing was tracked. Empty (null) when no API is configured.
 */
export function useTrackingHeatmap(): HeatmapResource {
  const base = apiBaseUrl
  const [data, setData] = useState<readonly HeatCell[] | null>(null)
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
    // End on this week's Sunday so the grid is exactly WEEKS whole Mon–Sun columns.
    const monday = weekStartIso(today)
    const sunday = new Date(Date.parse(`${monday}T00:00:00Z`) + 6 * DAY_MS)
      .toISOString()
      .slice(0, 10)
    const dates = lastNDates(sunday, DAYS)
    const from = dates[0] ?? today
    const to = new Date(Date.parse(`${sunday}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10)

    fetchSummary(base, { from, to, tz })
      .then(summary => {
        if (!alive) return
        setData(dailyMinutesSeries(dates, focusMinutesByDate(summary)))
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
