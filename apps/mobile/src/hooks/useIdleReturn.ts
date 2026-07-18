import { useCallback, useEffect, useRef, useState } from 'react'
import { idleReturn } from '../reminder/idleReturn.js'

/** Re-evaluate the idle stretch on a slow clock — returns are also caught by the events. */
const CHECK_INTERVAL_MS = 30_000

export interface IdleReturnResource {
  /** The detected away-stretch (ms) to surface, or null when there is nothing to show. */
  readonly idleMs: number | null
  /** Dismiss the banner and reset the activity baseline (re-arms for the next absence). */
  readonly dismiss: () => void
}

/**
 * Surfaces the idle-return proposal while a timer runs (REQ-033, #42). Activity is
 * observed through web listeners (`pointerdown`, `keydown`, and the tab becoming visible
 * again), all guarded for non-DOM platforms; the pure `idleReturn` rule decides whether
 * the gap since the last activity counts as an absence. A detected stretch is latched —
 * the very interaction that brings the user back would otherwise clear it — until the
 * user dismisses (Keep/Stop on the banner). Nothing here mutates the timer or the entry:
 * the Today banner drives every action on the user's tap (ADR-0005).
 */
export function useIdleReturn(timerRunning: boolean, thresholdMs?: number): IdleReturnResource {
  const lastActiveAtRef = useRef(Date.now())
  const [idleMs, setIdleMs] = useState<number | null>(null)

  // A stopped timer never reports idle; a (re)started one begins from a fresh baseline.
  useEffect(() => {
    lastActiveAtRef.current = Date.now()
    setIdleMs(null)
  }, [timerRunning])

  useEffect(() => {
    if (!timerRunning) return
    const evaluate = (resetBaseline: boolean): void => {
      const now = Date.now()
      const hit = idleReturn({
        lastActiveAt: lastActiveAtRef.current,
        now,
        timerRunning: true,
        ...(thresholdMs === undefined ? {} : { thresholdMs }),
      })
      if (hit !== null) setIdleMs(hit.idleMs)
      if (resetBaseline) lastActiveAtRef.current = now
    }
    // Activity marks the return: evaluate the gap FIRST (latching a long absence), then
    // reset the baseline so ordinary activity keeps the gap at zero.
    const onActivity = (): void => {
      evaluate(true)
    }
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') evaluate(true)
    }
    const interval = setInterval(() => {
      evaluate(false)
    }, CHECK_INTERVAL_MS)
    const hasDom = typeof document !== 'undefined'
    if (hasDom) {
      document.addEventListener('pointerdown', onActivity)
      document.addEventListener('keydown', onActivity)
      document.addEventListener('visibilitychange', onVisibility)
    }
    return () => {
      clearInterval(interval)
      if (hasDom) {
        document.removeEventListener('pointerdown', onActivity)
        document.removeEventListener('keydown', onActivity)
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }, [timerRunning, thresholdMs])

  const dismiss = useCallback(() => {
    lastActiveAtRef.current = Date.now()
    setIdleMs(null)
  }, [])

  return { idleMs, dismiss }
}
