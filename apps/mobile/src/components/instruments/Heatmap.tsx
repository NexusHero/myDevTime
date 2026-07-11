import { View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

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

  return (
    <View style={{ gap: t.spacing.s2 }}>
      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, fontWeight: '500' }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s1 }}>
        {data.map(cell => {
          const intensity = cell.value / max
          const bgColor =
            intensity > 0.75
              ? t.color.accent
              : intensity > 0.5
                ? t.color.accentSoft
                : t.color.overlay

          return (
            <View
              key={cell.date}
              style={{
                width: 16,
                height: 16,
                borderRadius: 2,
                backgroundColor: bgColor,
              }}
            />
          )
        })}
      </View>
    </View>
  )
}
