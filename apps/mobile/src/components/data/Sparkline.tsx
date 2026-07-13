import { View } from 'react-native'
import Svg, { Polyline } from 'react-native-svg'
import { sparklinePoints } from '@mydevtime/design'
import { useTheme } from '../../theme/ThemeProvider'
import { useMountValue } from '../../hooks/useMountValue'

/**
 * Sparkline (data) — a small-multiple week trend (ux-vision §2.5: "small-multiple
 * sparklines instead of one giant chart"). The polyline points are computed by the
 * pure `sparklinePoints` (min→bottom, max→top); the component only draws them.
 */
interface SparklineProps {
  readonly values: readonly number[]
  readonly width?: number
  readonly height?: number
  readonly color?: string
  readonly label?: string
}

export function Sparkline({
  values,
  width = 120,
  height = 32,
  color,
  label,
}: SparklineProps): React.JSX.Element {
  const t = useTheme()
  const pad = 2
  const innerH = height - pad * 2
  const points = sparklinePoints(values, width - pad * 2, innerH)
  // Grow the trend up from the baseline on mount (design v4): each y eases from
  // the bottom (innerH) to its final position. `progress` is a 0→1 driver.
  const progress = useMountValue(1)
  const grown =
    progress >= 1
      ? points
      : points
          .split(' ')
          .map(pt => {
            const [x, y] = pt.split(',')
            const yFinal = Number(y)
            const yShown = innerH - (innerH - yFinal) * progress
            return `${x},${String(yShown)}`
          })
          .join(' ')

  return (
    <View accessibilityRole="image" accessibilityLabel={label ?? 'Weekly trend'}>
      <Svg width={width} height={height}>
        <Polyline
          points={grown}
          fill="none"
          stroke={color ?? t.color.accent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          translateX={pad}
          translateY={pad}
        />
      </Svg>
    </View>
  )
}
