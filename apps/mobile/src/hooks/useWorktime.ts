import { useCallback, useEffect, useState } from 'react'
import { apiBaseUrl } from '../config.js'
import { formatStopwatch } from '../api/timer.js'
import {
  clockIn as apiClockIn,
  clockOut as apiClockOut,
  fetchWorktimeSummary,
  getRunningShift,
  listShifts,
  type Overtime,
  type Shift,
} from '../api/worktime.js'

/**
 * The work-day punch clock (REQ-028, ADR-0010). When an API base URL is configured
 * it loads the open shift, this week's shifts (with their server-computed ArbZG §4
 * break shortfall) and the overtime balance, and drives clock-in/out through the
 * `worktime` routes; otherwise — the default in local dev and the test gate — it
 * runs a local demo so the screen still works without a backend. Clock-in/out
 * update optimistically and reconcile with (or roll back to) the server. `elapsed`
 * ticks once a second while clocked in, formatted by the pure `formatStopwatch`
 * (ADR-0005 keeps duration math out of the view).
 */
const H = 3_600_000
const M = 60_000

export interface WorktimeResource {
  readonly running: Shift | null
  readonly elapsed: string
  readonly shifts: readonly Shift[]
  readonly overtimeMs: number
  readonly loading: boolean
  readonly error: Error | null
  readonly live: boolean
  readonly busy: boolean
  readonly clockIn: () => void
  readonly clockOut: () => void
}

function demoShifts(): Shift[] {
  const day = (iso: string, h: number, breakMin: number, shortfallMin = 0): Shift => ({
    id: iso,
    startedAt: `${iso}T08:00:00.000Z`,
    endedAt: `${iso}T${String(8 + h).padStart(2, '0')}:00:00.000Z`,
    breakMs: breakMin * M,
    source: 'manual',
    breakShortfallMs: shortfallMin * M,
  })
  return [
    day('2026-07-10', 9, 30),
    day('2026-07-09', 9, 10, 20),
    day('2026-07-08', 8, 30),
    day('2026-07-07', 8, 30),
    day('2026-07-06', 8, 30),
  ]
}

/** The trailing 7-day window ending at the next UTC midnight. */
function trailingWeek(): { from: string; to: string; tz: string } {
  const to = new Date()
  to.setUTCHours(0, 0, 0, 0)
  to.setUTCDate(to.getUTCDate() + 1)
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 7)
  return { from: from.toISOString(), to: to.toISOString(), tz: 'UTC' }
}

export function useWorktime(): WorktimeResource {
  const base = apiBaseUrl
  const live = base !== null
  const [running, setRunning] = useState<Shift | null>(null)
  const [shifts, setShifts] = useState<readonly Shift[]>([])
  const [overtimeMs, setOvertimeMs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const range = trailingWeek()
    const load: Promise<{ running: Shift | null; shifts: Shift[]; overtime: Overtime }> =
      base === null
        ? Promise.resolve({
            running: null,
            shifts: demoShifts(),
            overtime: { workedMs: 42 * H, targetMs: 40 * H, balanceMs: 9 * H + 30 * M },
          })
        : Promise.all([
            getRunningShift(base),
            listShifts(base, range),
            fetchWorktimeSummary(base, range),
          ]).then(([r, s, o]) => ({ running: r, shifts: s, overtime: o }))
    load
      .then(({ running: r, shifts: s, overtime }) => {
        if (!alive) return
        setRunning(r)
        setShifts(s)
        setOvertimeMs(overtime.balanceMs)
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
  }, [base, reloadKey])

  // Tick while clocked in so the elapsed label advances.
  useEffect(() => {
    if (running === null) return
    setNowMs(Date.now())
    const id = setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => {
      clearInterval(id)
    }
  }, [running])

  const clockIn = useCallback(() => {
    const optimistic: Shift = {
      id: 'pending',
      startedAt: new Date().toISOString(),
      endedAt: null,
      breakMs: 0,
      source: 'clock',
      breakShortfallMs: 0,
    }
    setRunning(optimistic)
    setError(null)
    if (base === null) return
    setBusy(true)
    apiClockIn(base)
      .then(shift => {
        setRunning(shift)
      })
      .catch((cause: unknown) => {
        setRunning(null)
        setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        setBusy(false)
      })
  }, [base])

  const clockOut = useCallback(() => {
    setRunning(previous => {
      if (previous === null) return null
      if (base === null) return null // demo: local stop
      setBusy(true)
      apiClockOut(base)
        .then(() => {
          setError(null)
          setReloadKey(k => k + 1) // refresh the week + balance
        })
        .catch((cause: unknown) => {
          setRunning(previous) // roll back
          setError(cause instanceof Error ? cause : new Error(String(cause)))
        })
        .finally(() => {
          setBusy(false)
        })
      return null // optimistic clear
    })
  }, [base])

  const elapsed =
    running === null ? '00:00:00' : formatStopwatch(nowMs - Date.parse(running.startedAt))

  return { running, elapsed, shifts, overtimeMs, loading, error, live, busy, clockIn, clockOut }
}
