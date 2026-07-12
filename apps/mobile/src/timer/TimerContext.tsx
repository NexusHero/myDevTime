import { createContext, useContext } from 'react'
import { useTimer, type TimerResource } from '../hooks/useTimer'

/**
 * One shared live timer for the whole app. The Island (docked in the desktop
 * sidebar / floating on phone) and the Today hero tracker must read and drive the
 * *same* clock — never two independent timers. `useTimer` runs once inside the
 * provider at the app root; every consumer reads it through `useTimerContext`.
 */
const TimerContext = createContext<TimerResource | null>(null)

export function TimerProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const timer = useTimer()
  return <TimerContext.Provider value={timer}>{children}</TimerContext.Provider>
}

export function useTimerContext(): TimerResource {
  const value = useContext(TimerContext)
  if (value === null) throw new Error('useTimerContext must be used within a TimerProvider')
  return value
}
