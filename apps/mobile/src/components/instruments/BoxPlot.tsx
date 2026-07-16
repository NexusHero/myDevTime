import { View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

interface BoxPlotProps {
  readonly label: string
  readonly min: number
  readonly q1: number
  readonly median: number
  readonly q3: number
  readonly max: number
}

export function BoxPlot({ label, min, q1, median, q3, max }: BoxPlotProps): React.JSX.Element {
  const t = useTheme()
  const range = max - min
  const q1Pos = ((q1 - min) / range) * 100
  const medianPos = ((median - min) / range) * 100
  const q3Pos = ((q3 - min) / range) * 100

  return (
    <View style={{ gap: t.spacing.s2 }}>
      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>{label}</Text>
      {/* The box/whisker bars carry no text — announce the five-number summary. */}
      <View
        accessibilityRole="image"
        accessibilityLabel={`${label}: median ${String(median)}, interquartile ${String(q1)} to ${String(q3)}, range ${String(min)} to ${String(max)}`}
        style={{ height: 40, justifyContent: 'center' }}
      >
        <View
          style={{
            height: 20,
            backgroundColor: t.color.overlay,
            borderRadius: t.radius.chip,
            position: 'relative',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: `${q1Pos}%`,
              right: `${100 - q3Pos}%`,
              height: '100%',
              backgroundColor: t.color.accent,
              borderRadius: t.radius.chip,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: `${medianPos}%`,
              width: 2,
              height: '100%',
              backgroundColor: t.color.ink,
            }}
          />
        </View>
      </View>
    </View>
  )
}
