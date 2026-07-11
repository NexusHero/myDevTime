import { View } from 'react-native'
import { barFraction, budgetTone, type ConsumptionTone } from '@mydevtime/design'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * ProgressBar (data) — linear consumption bar for inline budget visualization.
 * Height: s2 (8pt), Radius: chip (6pt), fill animated on ratio change.
 * Fill color: good/warn/crit based on budgetTone() helper (deterministic per ratio).
 */
interface ProgressBarProps {
  /** Consumption ratio (consumed / limit); may exceed 1 when over budget. */
  readonly ratio: number
  /** Screen-reader label describing what the bar measures. */
  readonly label: string
  readonly height?: number
}

const TONE_FILL: Record<ConsumptionTone, (t: ReturnType<typeof useTheme>) => string> = {
  good: t => t.color.good,
  warn: t => t.color.warn,
  crit: t => t.color.crit,
}

export function ProgressBar({ ratio, label, height }: ProgressBarProps): React.JSX.Element {
  const t = useTheme()
  const fraction = barFraction(ratio)
  const percent = fraction * 100
  const fill = TONE_FILL[budgetTone(ratio)](t)
  const barHeight = height ?? t.spacing.s2
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
      style={{
        height: barHeight,
        borderRadius: t.radius.chip,
        backgroundColor: t.color.overlay,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${percent}%`,
          height: '100%',
          borderRadius: t.radius.chip,
          backgroundColor: fill,
        }}
      />
    </View>
  )
}
