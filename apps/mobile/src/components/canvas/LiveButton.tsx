import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

/**
 * LiveButton — wraps the Today tracker's primary Stempel button with the design
 * v4 "happening now" motion: while `active`, the button gently breathes and emits
 * expanding pulse waves in the given signal colour. It wraps arbitrary children
 * (the real Pressable) so the button's own logic and touch target are untouched.
 *
 * All motion is gated behind the OS reduced-motion setting: when the user opts
 * out (or the session is idle) it is a plain, static container.
 */
interface LiveButtonProps {
  readonly active: boolean
  readonly color: string
  readonly size: number
  readonly children: React.ReactNode
}

const WAVE_COUNT = 2
const WAVE_MS = 2400

function Wave({
  index,
  color,
  size,
}: {
  readonly index: number
  readonly color: string
  readonly size: number
}): React.JSX.Element {
  const v = useSharedValue(0)
  useEffect(() => {
    v.value = withDelay(
      (index * WAVE_MS) / WAVE_COUNT,
      withRepeat(
        withTiming(1, { duration: WAVE_MS, easing: Easing.inOut(Easing.ease) }),
        -1,
        false,
      ),
    )
  }, [v, index])
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.65 + v.value * 1.25 }],
    opacity: 0.35 * (1 - v.value),
  }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  )
}

export function LiveButton({ active, color, size, children }: LiveButtonProps): React.JSX.Element {
  const reduce = useReducedMotion()
  const animate = active && !reduce
  const breathe = useSharedValue(0)

  useEffect(() => {
    breathe.value = animate
      ? withRepeat(
          withTiming(1, { duration: WAVE_MS, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        )
      : 0
  }, [animate, breathe])

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.06 }],
  }))

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {animate &&
        Array.from({ length: WAVE_COUNT }, (_, i) => (
          <Wave key={i} index={i} color={color} size={size} />
        ))}
      <Animated.View style={breatheStyle}>{children}</Animated.View>
    </View>
  )
}
