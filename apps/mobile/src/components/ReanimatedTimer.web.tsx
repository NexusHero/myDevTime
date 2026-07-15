import { useEffect, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import type { ReanimatedTimerProps } from './ReanimatedTimer'

/** Format elapsed ms as HH:MM:SS */
function formatHms(ms: number): string {
  const total = ms > 0 ? Math.floor(ms / 1000) : 0
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number): string => (n < 10 ? `0${String(n)}` : String(n))
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/**
 * Web-specific implementation of the live stopwatch.
 * React Native Web does not support animating TextInput `value` via Reanimated 3
 * `useAnimatedProps` without heavy polyfills. Since the Web has no JS bridge and
 * React DOM is extremely fast at updating text nodes, we use a standard 1Hz interval
 * inside this leaf component. This prevents the parent `Island` or `TodayScreen`
 * from re-rendering, achieving the same performance goal as the native worklet.
 */
export function ReanimatedTimer({
  startedAt,
  accumulatedMs = 0,
  style,
}: ReanimatedTimerProps): React.JSX.Element {
  const startMs = Date.parse(startedAt)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <Text style={[styles.base, style]} accessibilityRole="timer">
      {formatHms(accumulatedMs + (now - startMs))}
    </Text>
  )
}

const styles = StyleSheet.create({
  base: {
    padding: 0,
  },
})
