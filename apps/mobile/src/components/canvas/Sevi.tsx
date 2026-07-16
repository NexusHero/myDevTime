import { useEffect } from 'react'
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Sevi — the Sevinç-dot as an **edge mascot** (design-system playfulness, ADR-0061):
 * the orange Now-dot given a face. Appears ONLY in the margins — empty states,
 * onboarding, celebrations — never inside working UI, and the logo mark itself stays
 * faceless. `mood` picks the expression: `focus` (open, a small smile, gently bobbing),
 * `pause` (eyes closed, a "z", still) and `celebrate` (happy eyes, a big grin, hopping).
 * The whole figure animates as one `Animated.View`; all motion gates behind the OS
 * reduced-motion setting, so opting out (or `pause`) is a plain static mascot.
 */
export type SeviMood = 'focus' | 'pause' | 'celebrate'

// The mascot's face ink — a fixed near-black that reads on the orange body in both
// modes (documented raw-hex exception, see scripts/design-adherence-baseline.json).
const FACE = '#12151b'

export function Sevi({
  mood = 'focus',
  size = 72,
}: {
  readonly mood?: SeviMood
  readonly size?: number
}): React.JSX.Element {
  const t = useTheme()
  const reduce = useReducedMotion()
  const animate = !reduce && mood !== 'pause'
  const bob = useSharedValue(0)

  useEffect(() => {
    if (!animate) {
      bob.value = 0
      return
    }
    if (mood === 'celebrate') {
      // A cheerful hop: up sharply, land, small settle — looping.
      bob.value = withRepeat(
        withSequence(
          withTiming(-0.14, { duration: 320, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 260, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 420, easing: Easing.linear }),
        ),
        -1,
        false,
      )
    } else {
      // focus: a slow, calm bob.
      bob.value = withRepeat(
        withTiming(-0.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      )
    }
  }, [animate, mood, bob])

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value * size }] }))

  return (
    <Animated.View style={style}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Circle cx={60} cy={60} r={44} fill={t.color.live} opacity={mood === 'pause' ? 0.82 : 1} />
        {mood === 'focus' && (
          <>
            <Circle cx={46} cy={54} r={6} fill={FACE} />
            <Circle cx={74} cy={54} r={6} fill={FACE} />
            <Path
              d="M48 74 Q60 84 72 74"
              fill="none"
              stroke={FACE}
              strokeWidth={5}
              strokeLinecap="round"
            />
          </>
        )}
        {mood === 'pause' && (
          <>
            <Path
              d="M40 56 L52 56 M68 56 L80 56"
              stroke={FACE}
              strokeWidth={5}
              strokeLinecap="round"
            />
            <Path
              d="M50 76 Q60 80 70 76"
              fill="none"
              stroke={FACE}
              strokeWidth={5}
              strokeLinecap="round"
            />
            <SvgText
              x={88}
              y={34}
              fontFamily={t.fontFamily.numeric}
              fontSize={17}
              fontWeight="700"
              fill={t.color.ink3}
            >
              z
            </SvgText>
          </>
        )}
        {mood === 'celebrate' && (
          <>
            <Path
              d="M40 52 Q46 44 52 52 M68 52 Q74 44 80 52"
              fill="none"
              stroke={FACE}
              strokeWidth={5}
              strokeLinecap="round"
            />
            <Path
              d="M44 72 Q60 90 76 72"
              fill="none"
              stroke={FACE}
              strokeWidth={5}
              strokeLinecap="round"
            />
          </>
        )}
      </Svg>
    </Animated.View>
  )
}
