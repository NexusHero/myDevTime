import { useCallback, useEffect, useState } from 'react'
import { forgottenTimerProposal, type ForgottenTimerProposal } from '../reminder/forgottenTimer.js'

/** Re-check the running timer's age about once a minute — the nag only fires after hours. */
const CHECK_INTERVAL_MS = 60_000

export interface ForgottenTimerResource {
  /** The forgotten-timer proposal to show, or null when there's nothing to propose. */
  readonly proposal: ForgottenTimerProposal | null
  /** Dismiss the proposal for the current run (re-arms when the next timer starts). */
  readonly dismiss: () => void
}

/**
 * Surfaces the forgotten-timer proposal for the running timer (REQ-033). Evaluates the
 * pure `forgottenTimerProposal` against the run's start and a slow clock; dismissal is
 * keyed to the running entry id, so accepting/dismissing one run re-arms cleanly for the
 * next. Nothing here mutates the timer — the Today card drives stop/trim on the user's tap.
 */
export function useForgottenTimer(
  startedAtMs: number | null,
  runId: string | null,
): ForgottenTimerResource {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [dismissedRunId, setDismissedRunId] = useState<string | null>(null)

  useEffect(() => {
    if (startedAtMs === null) return
    setNowMs(Date.now())
    const id = setInterval(() => {
      setNowMs(Date.now())
    }, CHECK_INTERVAL_MS)
    return () => {
      clearInterval(id)
    }
  }, [startedAtMs])

  const dismiss = useCallback(() => {
    setDismissedRunId(runId)
  }, [runId])

  const proposal = forgottenTimerProposal({
    startedAtMs,
    nowMs,
    dismissed: runId !== null && runId === dismissedRunId,
  })

  return { proposal, dismiss }
}
