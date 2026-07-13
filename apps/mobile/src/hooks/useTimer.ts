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
 * The live timer for the Island (REQ-004, ux-vision §2.3). Three modes:
 * - **API** (`apiBaseUrl` set): load the running entry and drive start/stop
 *   through the tracking routes, reconciling optimistically.
 * - **Offline** (no API, local DB open): persist the running timer in the local
 *   SQLite store (ADR-0040), so a running timer **survives an app reload**.
 * - **Demo** (no DB yet, e.g. the test gate): an in-memory local timer.
 * The elapsed duration is always formatted by the pure `formatStopwatch`, never
 * computed inline (ADR-0005 keeps math out of the view). Pause banks time in
 * session state; a running timer restores across reload, a paused one resumes
 * within the session.
 */
export interface TimerResource {
  readonly running: TimeEntry | null
  /**
   * A formatted snapshot of the elapsed time at render (idle/paused display).
   * While a segment runs the live seconds are driven on the UI thread by
   * `ReanimatedTimer` from `running.startedAt` + `accumulatedMs` — so the hook no
   * longer re-renders once a second (perf, ADR-0039).
   */
  readonly elapsed: string
  /** Milliseconds banked from previous paused segments this session. */
  readonly accumulatedMs: number
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
  // Real pause is segment-based: `accumulatedMs` banks completed segments; while
  // `pausedInput` is set the session is paused (no running segment) and can resume.
  const [accumulatedMs, setAccumulatedMs] = useState(0)
  const [pausedInput, setPausedInput] = useState<StartTimerInput | null>(null)

  // Load the running entry once. API → server; offline → the local store (restores
  // a running timer after a reload); demo → idle.
  useEffect(() => {
    let alive = true
    setLoading(true)
    const load: Promise<TimeEntry | null> = base !== null ? getRunning(base) : Promise.resolve(null)
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

  // Start a segment (optimistic, then reconcile with the server or the local store).
  const beginEntry = useCallback(
    (input: StartTimerInput) => {
      setRunning(provisionalEntry(input, new Date()))
      setError(null)
      if (base !== null) {
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
      }
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
      const rollback = (cause: unknown): void => {
        setRunning(previous)
        setAccumulatedMs(a => a - segMs)
        setPausedInput(null)
        setError(cause instanceof Error ? cause : new Error(String(cause)))
      }
      if (base !== null) {
        setBusy(true)
        stopTimer(base)
          .then(() => {
            setError(null)
          })
          .catch(rollback)
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
      if (previous === null) return null
      if (base !== null) {
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
      }
      return null // optimistic clear
    })
  }, [base])

  const elapsed = formatStopwatch(sessionElapsedMs(accumulatedMs, running, new Date()))
  const paused = pausedInput !== null

  return {
    running,
    elapsed,
    accumulatedMs,
    loading,
    error,
    live,
    busy,
    paused,
    punchIn,
    punchOut,
    pause,
    resume,
  }
}
