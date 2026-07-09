import { View } from 'react-native'
import { Text } from '../core/Text'
import Svg, { Circle } from 'react-native-svg'
import { budgetTone, formatPercent, ringDashOffset, type ConsumptionTone } from '@mydevtime/design'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * BudgetRing (data) — a project's budget consumption as a ring (ux-vision §2.5).
 * The painted arc length and tone come from the pure `ringDashOffset` / `budgetTone`
 * helpers (ADR-0005); an over-budget ratio fills the ring and turns it `crit`. The
 * center reads the exact percentage in tabular numerals.
 */
interface BudgetRingProps {
  readonly ratio: number
  readonly size?: number
  readonly stroke?: number
  readonly label?: string
}

const TONE_COLOR: Record<ConsumptionTone, (t: ReturnType<typeof useTheme>) => string> = {
  good: t => t.color.good,
  warn: t => t.color.warn,
  crit: t => t.color.crit,
}

export function BudgetRing({
  ratio,
  size = 76,
  stroke = 8,
  label,
}: BudgetRingProps): React.JSX.Element {
  const t = useTheme()
  const r = (size - stroke) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * r
  const color = TONE_COLOR[budgetTone(ratio)](t)

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="image"
      accessibilityLabel={`${label ?? 'Budget'}: ${formatPercent(ratio)} consumed`}
    >
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={t.color.sunk} strokeWidth={stroke} fill="none" />
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={ringDashOffset(ratio, circumference)}
          rotation={-90}
          originX={c}
          originY={c}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize.sm,
            fontWeight: '700',
            color: t.color.ink,
          }}
        >
          {formatPercent(ratio)}
        </Text>
      </View>
    </View>
  )
}
