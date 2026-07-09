import { View } from 'react-native'
import { barFraction, budgetTone, type ConsumptionTone } from '@mydevtime/design'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * ProgressBar (data) — a flat consumption bar for budget rings' humble sibling
 * (the SVG ring instrument lands with the Reports slice; this bar is the calm
 * inline form used in lists). The fill fraction and tone are computed by the pure
 * `barFraction`/`budgetTone` helpers (ux-vision §2.5, ADR-0005): the ratio is
 * clamped to the track, but an over-budget ratio still colors the bar `crit`.
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

export function ProgressBar({ ratio, label, height = 6 }: ProgressBarProps): React.JSX.Element {
  const t = useTheme()
  const fraction = barFraction(ratio)
  const percent = fraction * 100
  const fill = TONE_FILL[budgetTone(ratio)](t)
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
      style={{
        height,
        borderRadius: t.radius.pill,
        backgroundColor: t.color.sunk,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${percent}%`,
          height: '100%',
          borderRadius: t.radius.pill,
          backgroundColor: fill,
        }}
      />
    </View>
  )
}
