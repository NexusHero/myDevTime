import { View } from 'react-native'
import Svg, { Circle, Line, Path } from 'react-native-svg'
import { gaugeAngle, polarToCartesian } from '@mydevtime/design'
import { useTheme } from '../../theme/ThemeProvider'
import { useMountValue } from '../../hooks/useMountValue'

/**
 * Gauge (data) — a symmetric balance gauge for a signed value around zero
 * (overtime balance, ux-vision §2.5): a semicircle track with a needle deflected
 * by the pure `gaugeAngle` (`0 → up`, `±range → ±90°`). The needle position is
 * deterministic; the component is a thin SVG shell (ADR-0005).
 */
interface GaugeProps {
  readonly value: number
  readonly range: number
  readonly size?: number
  readonly label?: string
}

export function Gauge({ value, range, size = 132, label }: GaugeProps): React.JSX.Element {
  const t = useTheme()
  const stroke = 9
  const c = size / 2
  const r = c - stroke
  const height = c + stroke
  const left = polarToCartesian(c, c, r, -90)
  const right = polarToCartesian(c, c, r, 90)
  const track = `M ${String(left.x)} ${String(left.y)} A ${String(r)} ${String(r)} 0 0 1 ${String(right.x)} ${String(right.y)}`
  // The needle swings out from the zero (up) position to the real value on mount
  // (design v4); the tone stays fixed by the real sign so it never flips mid-swing.
  const shown = useMountValue(value)
  const needle = polarToCartesian(c, c, r - 6, gaugeAngle(shown, range))
  const tone = value >= 0 ? t.color.good : t.color.crit

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${label ?? 'Balance'}: ${value >= 0 ? '+' : ''}${String(value)} of ±${String(range)}`}
      style={{ width: size, height }}
    >
      <Svg width={size} height={height}>
        <Path
          d={track}
          stroke={t.color.sunk}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
        />
        <Line
          x1={c}
          y1={c}
          x2={needle.x}
          y2={needle.y}
          stroke={tone}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Circle cx={c} cy={c} r={5} fill={t.color.ink} />
      </Svg>
    </View>
  )
}
