import { useEffect, useState } from 'react'
import type { TextStyle } from 'react-native'
import { formatStopwatch, pauseDurationMs } from '../../api/timer'
import { Text } from '../core/Text'

/**
 * The live "Pause MM:SS" counter that stacks **under** the frozen worked time while a
 * session is paused (design v10 — the pause counts up, the work total does not). It
 * ticks once a second from `pausedSinceMs` (the instant the pause began, persisted so
 * it survives a reload) using the pure `pauseDurationMs`; the `HH:` head is sliced off
 * so only minutes:seconds show. Renders nothing when not paused (`pausedSinceMs` null).
 * Display-only — the source of truth stays in `useTimer` (ADR-0005 keeps math out of
 * the view; the arithmetic is the pure helper).
 */
export interface PauseCounterProps {
  /** When the current pause began (ms epoch), or null when not paused. */
  readonly pausedSinceMs: number | null
  readonly style?: TextStyle
}

export function PauseCounter({
  pausedSinceMs,
  style,
}: PauseCounterProps): React.JSX.Element | null {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (pausedSinceMs === null) return
    const id = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => {
      clearInterval(id)
    }
  }, [pausedSinceMs])

  if (pausedSinceMs === null) return null
  // `formatStopwatch` yields HH:MM:SS; the pause is short-lived, so show MM:SS only.
  const label = formatStopwatch(pauseDurationMs(pausedSinceMs, now)).slice(3)
  return (
    <Text style={style} accessibilityLabel={`Paused ${label}`}>
      {`Pause ${label}`}
    </Text>
  )
}
