import { useCallback, useEffect, useState } from 'react'
import { apiBaseUrl } from '../config.js'
import {
  entryDurationMs,
  formatStopwatch,
  getRunning,
  patchEntryBillable,
  provisionalEntry,
  resumeInput,
  sessionElapsedMs,
  startTimer,
  stopTimer,
  type StartTimerInput,
  type TimeEntry,
} from '../api/timer.js'
import { reconcileTimer } from '../timer/reconcile.js'
import { loadTimerSession, saveTimerSession } from '../timer/timerStore.js'

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
  /**
   * Whether the current (or next) session is billable — the running entry's flag
   * when one is active, else the default the next punch-in will carry (design v6 B5).
   */
  readonly billable: boolean
  readonly punchIn: (input?: StartTimerInput) => void
  readonly punchOut: () => void
  /** Stop the running segment (persisting it) and hold the context to resume. */
  readonly pause: () => void
  /** Start a fresh segment from the paused context; the total keeps climbing. */
  readonly resume: () => void
  /**
   * Flip billable: patches the running entry live (server-authoritative money,
   * ADR-0005) and sets the default for the next start. Optimistic; rolls back the
   * running entry on failure.
   */
  readonly setBillable: (next: boolean) => void
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
  // The billable default the next punch-in carries; a running entry's own flag wins.
  const [billableDefault, setBillableDefault] = useState(true)
  // Whether the session state has been restored from persistence yet — the persist
  // effect stays quiet until then, so hydration never overwrites the stored session.
  const [hydrated, setHydrated] = useState(false)

  // Restore the timer once, so a running OR paused session survives an app restart
  // (REQ-004). The server is authoritative for a running segment; the locally-stored
  // session carries the banked total + paused context; `reconcileTimer` merges them.
  // Demo mode (no API) stays ephemeral — nothing is persisted or restored.
  useEffect(() => {
    let alive = true
    if (base === null) {
      setLoading(false)
      setHydrated(true)
      return
    }
    setLoading(true)
    getRunning(base)
      .then(entry => {
        if (!alive) return
        const restored = reconcileTimer(entry, loadTimerSession())
        setRunning(restored.running)
        setAccumulatedMs(restored.accumulatedMs)
        setPausedInput(restored.pausedInput)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        if (alive) {
          setLoading(false)
          setHydrated(true)
        }
      })
    return () => {
      alive = false
    }
  }, [base])

  // Persist the client-only session (banked total + paused context) on every change
  // once hydrated, so a reload restores it; clears when the session ends. Live mode
  // only — demo/test stays in-memory (matches the storage story of `onboardingStore`).
  useEffect(() => {
    if (!hydrated || base === null) return
    const active = running !== null || pausedInput !== null
    saveTimerSession(active ? { accumulatedMs, pausedInput } : null)
  }, [hydrated, base, running, pausedInput, accumulatedMs])

  // Start a segment (optimistic, then reconcile with the server or the local store).
  const beginEntry = useCallback(
    (input: StartTimerInput) => {
      // The running entry carries the billable default unless the caller set one.
      const withBillable: StartTimerInput = { billable: billableDefault, ...input }
      setRunning(provisionalEntry(withBillable, new Date()))
      setError(null)
      if (base !== null) {
        setBusy(true)
        startTimer(base, withBillable)
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
    [base, billableDefault],
  )

  // Flip billable: set the next-start default and, if a real entry is running,
  // patch it live (optimistic; roll back on failure). A provisional ('pending')
  // entry isn't patched — its start already carries the new default.
  const setBillable = useCallback(
    (next: boolean) => {
      setBillableDefault(next)
      setRunning(previous => {
        if (previous === null) return null
        if (base !== null && previous.id !== 'pending') {
          patchEntryBillable(base, previous.id, next).catch((cause: unknown) => {
            setRunning(current =>
              current !== null && current.id === previous.id
                ? { ...current, billable: previous.billable }
                : current,
            )
            setError(cause instanceof Error ? cause : new Error(String(cause)))
          })
        }
        return { ...previous, billable: next }
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
  const billable = running?.billable ?? billableDefault

  return {
    running,
    elapsed,
    accumulatedMs,
    loading,
    error,
    live,
    busy,
    paused,
    billable,
    punchIn,
    punchOut,
    pause,
    resume,
    setBillable,
  }
}
