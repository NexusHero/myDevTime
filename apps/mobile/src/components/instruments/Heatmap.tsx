import { View } from 'react-native'
import { clamp01 } from '@mydevtime/design'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'
import { useMountValue } from '../../hooks/useMountValue'

// Cells beyond the leading edge that are still easing in — the width of the wave.
const WAVE_TAIL = 6

interface HeatmapCell {
  readonly date: string
  readonly value: number
}

interface HeatmapProps {
  readonly label: string
  readonly data: readonly HeatmapCell[]
  readonly max?: number
}

export function Heatmap({
  label,
  data,
  max = Math.max(...data.map(d => d.value)),
}: HeatmapProps): React.JSX.Element {
  const t = useTheme()
  // Cells fade/scale in as a wave that sweeps across the grid on mount (design v4).
  // A single 0→1 driver moves a leading edge; each cell reveals as it's reached.
  const progress = useMountValue(1, 600)

  return (
    <View style={{ gap: t.spacing.s2 }}>
      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, fontWeight: '500' }}>
        {label}
      </Text>
      {/* The colour grid is invisible to assistive tech; summarise it as one image. */}
      <View
        accessibilityRole="image"
        accessibilityLabel={`${label}: activity across ${String(data.length)} days, peak ${String(max)}`}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s1 }}
      >
        {data.map((cell, i) => {
          const intensity = cell.value / max
          const bgColor =
            intensity > 0.75
              ? t.color.accent
              : intensity > 0.5
                ? t.color.accentSoft
                : t.color.overlay
          const reveal = clamp01((progress * (data.length + WAVE_TAIL) - i) / WAVE_TAIL)

          return (
            <View
              key={cell.date}
              style={{
                width: 16,
                height: 16,
                borderRadius: 2,
                backgroundColor: bgColor,
                opacity: reveal,
                transform: [{ scale: 0.4 + reveal * 0.6 }],
              }}
            />
          )
        })}
      </View>
    </View>
  )
}
