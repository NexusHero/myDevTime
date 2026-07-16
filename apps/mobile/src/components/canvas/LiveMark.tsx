import { useEffect } from 'react'
import { View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * LiveMark — the myDevTime "Now-Split" mark as a *living* character (design-system
 * playfulness, ADR-0061). The mark is a solid actual-block · an orange S-signature ·
 * a dashed ghost-block; the orange **Now-dot** beneath the S is its face and the one
 * moving element: it blinks when idle, pulses (with an expanding ring) while a timer
 * runs, and does a one-shot jump on punch-out (`celebrate`).
 *
 * The blocks + S render as a static SVG (brand geometry, token-coloured: `accent`
 * for the blocks, `live` orange for the S + dot — theme-independent). Only the dot
 * animates, as an overlaid `Animated.View`, so nothing in the SVG internals moves —
 * the same view-wrapper motion pattern as `LiveButton`. All motion gates behind the
 * OS reduced-motion setting: opting out (or `idle` at rest) is a plain static mark.
 */
export type LiveMarkState = 'idle' | 'tracking' | 'celebrate'

interface LiveMarkProps {
  readonly state?: LiveMarkState
  readonly size?: number
}

// The mark's design grid; the SVG scales it to `size`. The dot sits at (128, 184).
const VIEWBOX = 256
const DOT_CX = 128
const DOT_CY = 184
const DOT_R = 12

export function LiveMark({ state = 'idle', size = 40 }: LiveMarkProps): React.JSX.Element {
  const t = useTheme()
  const reduce = useReducedMotion()
  const animate = !reduce

  const scale = size / VIEWBOX
  const dotSize = DOT_R * 2 * scale
  const dotLeft = (DOT_CX - DOT_R) * scale
  const dotTop = (DOT_CY - DOT_R) * scale

  // One driver per motion; each resolves to its rest value when motion is off.
  const blink = useSharedValue(1) // scaleY, idle
  const pulse = useSharedValue(1) // scale, tracking
  const ring = useSharedValue(0) // 0→1 expanding ring, tracking
  const jump = useSharedValue(0) // translateY, celebrate

  useEffect(() => {
    if (!animate) {
      blink.value = 1
      pulse.value = 1
      ring.value = 0
      jump.value = 0
      return
    }
    if (state === 'tracking') {
      blink.value = 1
      pulse.value = withRepeat(
        withTiming(1.22, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      )
      ring.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      )
      jump.value = 0
    } else if (state === 'celebrate') {
      pulse.value = 1
      ring.value = 0
      // One-shot jump: up, settle-under, up-a-little, rest.
      jump.value = withSequence(
        withTiming(-0.42, { duration: 270, easing: Easing.out(Easing.cubic) }),
        withTiming(0.05, { duration: 220, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 180, easing: Easing.out(Easing.ease) }),
      )
    } else {
      // idle: an occasional blink (a quick vertical squash, then hold open).
      pulse.value = 1
      ring.value = 0
      jump.value = 0
      blink.value = withRepeat(
        withSequence(
          withDelay(3600, withTiming(0.12, { duration: 90, easing: Easing.in(Easing.ease) })),
          withTiming(1, { duration: 140, easing: Easing.out(Easing.ease) }),
        ),
        -1,
        false,
      )
    }
  }, [animate, state, blink, pulse, ring, jump])

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: jump.value * size }, { scale: pulse.value }, { scaleY: blink.value }],
  }))
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ring.value),
    transform: [{ scale: 1 + ring.value * 1.6 }],
  }))

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox={`0 0 ${String(VIEWBOX)} ${String(VIEWBOX)}`}>
        {/* Actual block — solid, committed reality. */}
        <Rect x={42} y={96} width={56} height={72} rx={16} fill={t.color.accent} />
        {/* Ghost block — the Co-Planner's proposed plan, always a dashed outline. */}
        <Rect
          x={158}
          y={96}
          width={56}
          height={72}
          rx={16}
          fill="none"
          stroke={t.color.accent}
          strokeOpacity={0.65}
          strokeWidth={7}
          strokeDasharray="14 12"
          strokeLinecap="round"
        />
        {/* The S-signature (Suhay · Sevinç), in live orange — plan meets now. */}
        <Path
          d="M148 92 C122 84 106 96 112 110 C117 122 138 123 143 135 C148 148 132 160 108 153"
          fill="none"
          stroke={t.color.live}
          strokeWidth={12}
          strokeLinecap="round"
        />
      </Svg>
      {/* Tracking ring — an expanding, fading halo around the dot while a timer runs. */}
      {animate && state === 'tracking' && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: dotLeft,
              top: dotTop,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              borderWidth: 2,
              borderColor: t.color.live,
            },
            ringStyle,
          ]}
        />
      )}
      {/* The Now-dot — the mark's living "face". */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: dotLeft,
            top: dotTop,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: t.color.live,
          },
          dotStyle,
        ]}
      />
    </View>
  )
}
