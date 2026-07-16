import { useEffect } from 'react'
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Blocky — the Day-Canvas block as a character (design-system playfulness, ADR-0061).
 * `variant="solid"` is tracked reality (a filled accent block, confident smile, a calm
 * lean); `variant="ghost"` is the plan (a dashed accent outline, a curious look, a
 * livelier wobble) — the same solid-vs-dashed provenance rule the real Day Canvas uses.
 * The orange Now-dot floats as its head. Edge-only: it explains plan-vs-reality in
 * onboarding and empty states, never in working UI. The figure tilts as one
 * `Animated.View`, gated behind the OS reduced-motion setting (opting out is static).
 */
export type BlockyVariant = 'solid' | 'ghost'

// Face ink on the solid (accent-filled) block — a fixed white for contrast in both
// modes (documented raw-hex exception, see scripts/design-adherence-baseline.json).
const FACE_ON_SOLID = '#ffffff'

export function Blocky({
  variant = 'solid',
  size = 72,
}: {
  readonly variant?: BlockyVariant
  readonly size?: number
}): React.JSX.Element {
  const t = useTheme()
  const ghost = variant === 'ghost'
  const face = ghost ? t.color.accent : FACE_ON_SOLID
  const reduce = useReducedMotion()
  const tilt = useSharedValue(0)

  useEffect(() => {
    if (reduce) {
      tilt.value = 0
      return
    }
    // Ghost leans faster and wider (livelier, less settled); solid is calm.
    const amp = ghost ? 5 : 3
    const dur = ghost ? 900 : 1700
    tilt.value = withRepeat(
      withTiming(amp, { duration: dur, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
  }, [reduce, ghost, tilt])

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${String(tilt.value)}deg` }] }))

  return (
    <Animated.View style={style}>
      <Svg
        width={size}
        height={size * 1.083}
        viewBox="0 0 120 130"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {ghost ? (
          <Rect
            x={30}
            y={34}
            width={60}
            height={76}
            rx={16}
            fill="none"
            stroke={t.color.accent}
            strokeWidth={6}
            strokeDasharray="13 11"
            strokeLinecap="round"
          />
        ) : (
          <Rect x={30} y={34} width={60} height={76} rx={16} fill={t.color.accent} />
        )}
        <Circle cx={48} cy={62} r={5.5} fill={face} />
        <Circle cx={72} cy={62} r={5.5} fill={face} />
        {ghost ? (
          <Ellipse
            cx={60}
            cy={84}
            rx={7}
            ry={9}
            fill="none"
            stroke={t.color.accent}
            strokeWidth={4.5}
          />
        ) : (
          <Path
            d="M50 82 Q60 90 70 82"
            fill="none"
            stroke={FACE_ON_SOLID}
            strokeWidth={4.5}
            strokeLinecap="round"
          />
        )}
        <Circle cx={60} cy={22} r={9} fill={t.color.live} />
      </Svg>
    </Animated.View>
  )
}
