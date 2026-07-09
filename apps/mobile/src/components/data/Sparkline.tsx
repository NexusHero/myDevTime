import { View } from 'react-native'
import Svg, { Polyline } from 'react-native-svg'
import { sparklinePoints } from '@mydevtime/design'
import { useTheme } from '../../theme/ThemeProvider'

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
  const points = sparklinePoints(values, width - pad * 2, height - pad * 2)

  return (
    <View accessibilityRole="image" accessibilityLabel={label ?? 'Weekly trend'}>
      <Svg width={width} height={height}>
        <Polyline
          points={points}
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
