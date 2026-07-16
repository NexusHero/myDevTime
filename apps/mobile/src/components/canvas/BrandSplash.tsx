import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'
import { LiveMark } from './LiveMark'

/**
 * BrandSplash — the one-shot launch "sting" (design-system splash, ADR-0061): on a
 * cold start the "Now-Split" mark springs in and the Now-dot celebrates (its jump),
 * the wordmark fades up beneath, then the whole overlay fades out and hands over to
 * the app. It runs **once per launch** (`hasPlayedSplash`) and never loops. Reduced
 * motion collapses it to a brief static hold. The caller unmounts it on `onDone`.
 */
const TOTAL_MS = 1800
const REDUCED_MS = 400

// Module-level: the sting plays once per JS session (cold start), never on re-render
// or navigation. A web reload is a new session — that is the intended "once per launch".
let hasPlayed = false

export function hasPlayedSplash(): boolean {
  return hasPlayed
}

export function BrandSplash({ onDone }: { readonly onDone: () => void }): React.JSX.Element {
  const t = useTheme()
  const reduce = useReducedMotion()
  const fade = useSharedValue(reduce ? 1 : 0)
  const rise = useSharedValue(reduce ? 0 : 8)

  useEffect(() => {
    hasPlayed = true
    const total = reduce ? REDUCED_MS : TOTAL_MS
    if (!reduce) {
      // Fade the overlay in, hold, then fade out just before handing over.
      fade.value = withSequence(
        withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) }),
        withDelay(
          total - 220 - 260,
          withTiming(0, { duration: 260, easing: Easing.in(Easing.ease) }),
        ),
      )
      rise.value = withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) })
    }
    const id = setTimeout(onDone, total)
    return () => clearTimeout(id)
  }, [reduce, fade, rise, onDone])

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fade.value }))
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: rise.value }],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: t.color.bg }, overlayStyle]}
    >
      <LiveMark state="celebrate" size={96} />
      <Animated.View style={wordmarkStyle}>
        <View style={styles.word}>
          <Text
            style={{
              fontFamily: t.fontFamily.display,
              fontSize: t.fontSize.xl,
              color: t.color.ink,
            }}
          >
            myDevTime
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  word: { marginTop: 4 },
})
