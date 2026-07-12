import React, { useEffect } from 'react'
import { TextInput, StyleSheet, type TextInputProps, Platform } from 'react-native'
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useDerivedValue,
} from 'react-native-reanimated'

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

export interface ReanimatedTimerProps extends Omit<TextInputProps, 'value' | 'editable'> {
  /** Timestamp when the timer was started (ISO string) */
  startedAt: string
  /** Any ms banked from previous paused segments */
  accumulatedMs?: number
}

// Worklet to format ms as HH:MM:SS
function formatStopwatchWorklet(ms: number): string {
  'worklet'
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  const pad = (n: number) => {
    'worklet'
    return n < 10 ? '0' + n : '' + n
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function ReanimatedTimer({
  startedAt,
  accumulatedMs = 0,
  style,
  ...rest
}: ReanimatedTimerProps) {
  // We use a shared value that cycles infinitely to drive the worklet clock
  const ticker = useSharedValue(0)

  // start JS timestamp
  const startMs = Date.parse(startedAt)

  useEffect(() => {
    ticker.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.linear }), -1, false)
    return () => {
      ticker.value = 0
    }
  }, [])

  // Derived value computing the actual string every frame
  const textValue = useDerivedValue(() => {
    // Read ticker to force dependency
    const _tick = ticker.value
    // Date.now() works in worklets in Reanimated 3+
    const now = Date.now()
    const ms = accumulatedMs + (now - startMs)
    return formatStopwatchWorklet(ms)
  }, [startMs, accumulatedMs])

  const animatedProps = useAnimatedProps(() => {
    return {
      text: textValue.value,
      // For web, value is used
      value: textValue.value,
    } as any
  })

  // We use TextInput as a Text node replacement because standard Text cannot
  // accept animated strings out of the box in Reanimated across all platforms reliably.
  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      animatedProps={animatedProps}
      style={[styles.text, style]}
      {...rest}
    />
  )
}

const styles = StyleSheet.create({
  text: {
    padding: 0,
    margin: 0,
    borderWidth: 0,
    color: 'inherit',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        cursor: 'default',
      },
    }),
  },
})
