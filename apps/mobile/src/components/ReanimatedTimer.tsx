import { useEffect } from 'react'
import { StyleSheet, TextInput, type TextInputProps, type TextStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

/**
 * The live stopwatch, ticking on the UI thread (perf, ADR-0039 direction). A
 * running clock re-rendered once a second forces React to re-render every screen
 * that shows it (Today hero + Island). Instead this drives a read-only
 * `AnimatedTextInput` from a shared value, so the seconds advance with **zero**
 * React re-renders — the JS thread is never touched while the timer runs.
 *
 * It is display-only: the source of truth stays in `useTimer` (segment start +
 * banked `accumulatedMs`), exactly as before. The idle/paused states render a
 * plain snapshot (`formatStopwatch`), so this component is used only while a
 * segment is actually running.
 */
export interface ReanimatedTimerProps {
  /** ISO timestamp when the current running segment started. */
  readonly startedAt: string
  /** Milliseconds banked from previous (paused) segments this session. */
  readonly accumulatedMs?: number
  readonly style?: TextStyle
}

/** Format elapsed ms as HH:MM:SS on the UI thread (mirror of `formatStopwatch`). */
function formatWorklet(ms: number): string {
  'worklet'
  const total = ms > 0 ? Math.floor(ms / 1000) : 0
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number): string => (n < 10 ? `0${String(n)}` : String(n))
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function ReanimatedTimer({
  startedAt,
  accumulatedMs = 0,
  style,
}: ReanimatedTimerProps): React.JSX.Element {
  const startMs = Date.parse(startedAt)
  // A shared value cycling once per second only exists to wake the derived value;
  // its actual number is irrelevant (the worklet reads Date.now()).
  const ticker = useSharedValue(0)

  useEffect(() => {
    ticker.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.linear }), -1, false)
    return () => {
      ticker.value = 0
    }
  }, [ticker])

  const text = useDerivedValue(() => {
    ticker.value // read to establish the per-frame dependency
    return formatWorklet(accumulatedMs + (Date.now() - startMs))
  }, [startMs, accumulatedMs])

  const animatedProps = useAnimatedProps(
    () => ({ text: text.value, value: text.value }) as unknown as Partial<TextInputProps>,
  )

  return (
    <AnimatedTextInput
      editable={false}
      // Non-animated default; the UI thread overwrites `text` every frame.
      defaultValue={formatWorklet(accumulatedMs + (Date.now() - startMs))}
      animatedProps={animatedProps}
      style={[styles.base, style]}
      accessibilityRole="timer"
    />
  )
}

const styles = StyleSheet.create({
  base: {
    padding: 0,
  },
})
