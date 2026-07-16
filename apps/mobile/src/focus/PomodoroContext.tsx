import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useTimerContext } from '../timer/TimerContext'
import type { TimerResource } from '../hooks/useTimer'
import {
  DEFAULT_POMODORO_CONFIG,
  advancePhase,
  isBreakPhase,
  phaseDurationMs,
  phaseRemainingMs,
  type PomodoroConfig,
  type PomodoroPhase,
} from './pomodoro'

/**
 * Focus mode / Pomodoro (REQ-032, ADR-0012) driven on top of the ONE shared timer. A
 * focus interval runs an ordinary timer segment (so its minutes reach the timesheet like
 * any tracked time); a break pauses it; the next focus resumes. This layer owns only the
 * cadence + the phase countdown — the pure `pomodoro` state machine decides transitions
 * (ADR-0005). Shared app-wide so both the Today control and the Island read the same
 * session, like `TimerContext`.
 */
export interface PomodoroResource {
  readonly active: boolean
  readonly phase: PomodoroPhase | null
  /** Milliseconds left in the current phase (drives the countdown). */
  readonly remainingMs: number
  /** Completed focus intervals this session. */
  readonly completedFocus: number
  /** Start a focus session (punches in a fresh timer and begins the first focus phase). */
  readonly start: (config?: PomodoroConfig) => void
  /** End the session and stop the timer. */
  readonly stop: () => void
  /** Jump to the next phase now (skip the rest of this focus/break). */
  readonly skip: () => void
}

const PomodoroContext = createContext<PomodoroResource | null>(null)

interface Session {
  readonly phase: PomodoroPhase
  readonly phaseEndsAtMs: number
  readonly completedFocus: number
  readonly config: PomodoroConfig
}

export function PomodoroProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const timer = useTimerContext()
  const [session, setSession] = useState<Session | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  // Refs keep the interval + transition free of stale closures without re-arming per render.
  const sessionRef = useRef<Session | null>(session)
  sessionRef.current = session
  const timerRef = useRef<TimerResource>(timer)
  timerRef.current = timer

  // Apply the transition that follows the current phase — pausing the timer into a break,
  // resuming it back into focus — and schedule the next phase's end. Pure decision, then
  // the two timer side-effects.
  const transition = useCallback((now: number) => {
    const s = sessionRef.current
    if (s === null) return
    const next = advancePhase(s.phase, s.completedFocus, s.config)
    if (isBreakPhase(next.phase) && !isBreakPhase(s.phase)) timerRef.current.pause()
    else if (!isBreakPhase(next.phase) && isBreakPhase(s.phase)) timerRef.current.resume()
    setSession({
      phase: next.phase,
      completedFocus: next.completedFocus,
      config: s.config,
      phaseEndsAtMs: now + phaseDurationMs(next.phase, s.config),
    })
  }, [])

  // Tick once a second while active: advance the clock and roll over when the phase ends.
  useEffect(() => {
    if (session === null) return
    const id = setInterval(() => {
      const now = Date.now()
      setNowMs(now)
      const s = sessionRef.current
      if (s !== null && now >= s.phaseEndsAtMs) transition(now)
    }, 1000)
    return () => {
      clearInterval(id)
    }
  }, [session === null, transition])

  // If the underlying timer ends outside the Pomodoro (a manual punch-out), end the
  // session too, so the cadence never keeps "running" over a stopped clock.
  useEffect(() => {
    if (session !== null && timer.running === null && !timer.paused) setSession(null)
  }, [session, timer.running, timer.paused])

  const start = useCallback(
    (config: PomodoroConfig = DEFAULT_POMODORO_CONFIG) => {
      timer.punchIn()
      const now = Date.now()
      setNowMs(now)
      setSession({
        phase: 'focus',
        completedFocus: 0,
        config,
        phaseEndsAtMs: now + config.focusMs,
      })
    },
    [timer],
  )

  const stop = useCallback(() => {
    timer.punchOut()
    setSession(null)
  }, [timer])

  const skip = useCallback(() => {
    transition(Date.now())
  }, [transition])

  const value: PomodoroResource = {
    active: session !== null,
    phase: session?.phase ?? null,
    remainingMs: session === null ? 0 : phaseRemainingMs(session.phaseEndsAtMs, nowMs),
    completedFocus: session?.completedFocus ?? 0,
    start,
    stop,
    skip,
  }

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>
}

export function usePomodoro(): PomodoroResource {
  const value = useContext(PomodoroContext)
  if (value === null) throw new Error('usePomodoro must be used within a PomodoroProvider')
  return value
}
