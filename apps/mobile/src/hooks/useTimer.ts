import { useCallback, useEffect, useState } from 'react'
import { apiBaseUrl } from '../config.js'
import {
  entryDurationMs,
  formatStopwatch,
  getRunning,
  provisionalEntry,
  resumeInput,
  sessionElapsedMs,
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
  /** True while the session is paused (no running segment, but time is banked to resume). */
  readonly paused: boolean
  readonly punchIn: (input?: StartTimerInput) => void
  readonly punchOut: () => void
  /** Stop the running segment (persisting it) and hold the context to resume. */
  readonly pause: () => void
  /** Start a fresh segment from the paused context; the total keeps climbing. */
  readonly resume: () => void
}

export function useTimer(): TimerResource {
  const base = apiBaseUrl
  const live = base !== null
  const [running, setRunning] = useState<TimeEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  // Real pause is segment-based: `accumulatedMs` banks completed segments; while
  // `pausedInput` is set the session is paused (no running segment) and can resume.
  const [accumulatedMs, setAccumulatedMs] = useState(0)
  const [pausedInput, setPausedInput] = useState<StartTimerInput | null>(null)

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

  // Start a segment (optimistic/demo, then reconcile with the server). Shared by a
  // fresh start and a resume; the caller decides whether to reset the accumulator.
  const beginEntry = useCallback(
    (input: StartTimerInput) => {
      setRunning(provisionalEntry(input, new Date()))
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

  const punchIn = useCallback(
    (input: StartTimerInput = {}) => {
      setAccumulatedMs(0) // a fresh session starts the total at zero
      setPausedInput(null)
      beginEntry(input)
    },
    [beginEntry],
  )

  const pause = useCallback(() => {
    setRunning(previous => {
      if (previous === null) return null
      const segMs = entryDurationMs(previous, new Date())
      setAccumulatedMs(a => a + segMs) // bank the worked segment
      setPausedInput(resumeInput(previous))
      if (base !== null) {
        setBusy(true)
        stopTimer(base)
          .then(() => {
            setError(null)
          })
          .catch((cause: unknown) => {
            // Roll the pause back so UI and server agree the timer is still running.
            setRunning(previous)
            setAccumulatedMs(a => a - segMs)
            setPausedInput(null)
            setError(cause instanceof Error ? cause : new Error(String(cause)))
          })
          .finally(() => {
            setBusy(false)
          })
      }
      return null // optimistic pause: no running segment
    })
  }, [base])

  const resume = useCallback(() => {
    if (pausedInput === null) return
    beginEntry(pausedInput) // new segment; accumulatedMs is preserved
    setPausedInput(null)
  }, [pausedInput, beginEntry])

  const punchOut = useCallback(() => {
    setAccumulatedMs(0)
    setPausedInput(null)
    setRunning(previous => {
      if (previous === null || base === null) return null // demo/paused: local stop
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

  const elapsed = formatStopwatch(sessionElapsedMs(accumulatedMs, running, new Date(nowMs)))
  const paused = pausedInput !== null

  return { running, elapsed, loading, error, live, busy, paused, punchIn, punchOut, pause, resume }
}
