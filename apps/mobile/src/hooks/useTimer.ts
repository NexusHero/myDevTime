import { useCallback, useEffect, useState } from 'react'
import { apiBaseUrl } from '../config.js'
import {
  formatStopwatch,
  getRunning,
  provisionalEntry,
  startTimer,
  stopTimer,
  type StartTimerInput,
  type TimeEntry,
} from '../api/timer.js'

/**
 * The live timer for the Island (REQ-004, ux-vision §2.3). When an API base URL is
 * configured it loads the running entry and drives start/stop through the tracking
 * routes; otherwise — the default in local dev — it runs a local demo timer so the
 * Island still ticks without a backend. Start/stop update optimistically and
 * reconcile with (or roll back to) the server's answer. `elapsed` ticks once a
 * second while running; the duration is formatted by the pure `formatStopwatch`,
 * never computed inline (ADR-0005 keeps math out of the view).
 */
export interface TimerResource {
  readonly running: TimeEntry | null
  readonly elapsed: string
  readonly loading: boolean
  readonly error: Error | null
  readonly live: boolean
  readonly busy: boolean
  readonly punchIn: (input?: StartTimerInput) => void
  readonly punchOut: () => void
}

export function useTimer(): TimerResource {
  const base = apiBaseUrl
  const live = base !== null
  const [running, setRunning] = useState<TimeEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  // Load the running entry once (demo mode starts idle).
  useEffect(() => {
    let alive = true
    setLoading(true)
    const load = base === null ? Promise.resolve<TimeEntry | null>(null) : getRunning(base)
    load
      .then(entry => {
        if (alive) {
          setRunning(entry)
          setError(null)
        }
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

  // Tick the clock while a timer runs, so the elapsed label advances.
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

  const punchIn = useCallback(
    (input: StartTimerInput = {}) => {
      setRunning(provisionalEntry(input, new Date())) // optimistic / demo
      setError(null)
      if (base === null) return
      setBusy(true)
      startTimer(base, input)
        .then(entry => {
          setRunning(entry)
        })
        .catch((cause: unknown) => {
          setRunning(null) // roll back
          setError(cause instanceof Error ? cause : new Error(String(cause)))
        })
        .finally(() => {
          setBusy(false)
        })
    },
    [base],
  )

  const punchOut = useCallback(() => {
    setRunning(previous => {
      if (base === null) return null // demo: local stop
      if (previous === null) return null
      setBusy(true)
      stopTimer(base)
        .then(() => {
          setError(null)
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

  return { running, elapsed, loading, error, live, busy, punchIn, punchOut }
}
