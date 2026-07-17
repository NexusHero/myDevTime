import { overtimeForecast, type OvertimeForecast } from '@mydevtime/domain'
import { apiBaseUrl } from '../config.js'
import { fetchWorktimeSummary } from '../api/worktime.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * Overtime compound trend (REQ-049, design v13 G3). Fetches the net overtime balance for
 * each of the last `WEEKS` calendar weeks and folds them through the deterministic
 * `overtimeForecast` — the running balance (the sparkline), a straight-line forecast, and
 * a pattern note. Every figure is the domain core's (ADR-0005); with no backend it
 * resolves empty, so the app fabricates no trend.
 */
const WEEKS = 8

export interface OvertimeTrendResource extends AsyncResource<OvertimeForecast | null> {
  readonly live: boolean
}

/** Local Monday 00:00 of the ISO week containing `d`. */
function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const iso = m.getDay() === 0 ? 7 : m.getDay()
  m.setDate(m.getDate() - (iso - 1))
  return m
}

export function useOvertimeTrend(): OvertimeTrendResource {
  const base = apiBaseUrl
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
  const thisMonday = mondayOf(new Date())

  const resource = useAsync<OvertimeForecast | null>(
    async () => {
      if (base === null) return null
      // Build WEEKS consecutive week windows, oldest first.
      const weeks = Array.from({ length: WEEKS }, (_, i) => {
        const from = new Date(thisMonday)
        from.setDate(from.getDate() - (WEEKS - 1 - i) * 7)
        const to = new Date(from)
        to.setDate(to.getDate() + 7)
        return { from, to }
      })
      const summaries = await Promise.all(
        weeks.map(w =>
          fetchWorktimeSummary(base, { from: w.from.toISOString(), to: w.to.toISOString(), tz }),
        ),
      )
      return overtimeForecast(
        summaries.map((s, i) => ({ weekStartMs: weeks[i]?.from.getTime() ?? 0, deltaMs: s.balanceMs })),
      )
    },
    `${base ?? 'demo'}:otrend:${thisMonday.toISOString().slice(0, 10)}`,
  )
  return { ...resource, live: base !== null }
}
