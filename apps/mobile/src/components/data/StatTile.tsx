import { View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

interface StatTileProps {
  readonly label: string
  readonly value: string
  readonly unit?: string
}

export function StatTile({ label, value, unit }: StatTileProps): React.JSX.Element {
  const t = useTheme()

  return (
    <View
      style={{
        padding: t.spacing.s4,
        borderRadius: t.radius.card,
        backgroundColor: t.color.raised,
        gap: t.spacing.s2,
      }}
    >
      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, fontWeight: '500' }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.s2 }}>
        <Text
          style={{
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize.lg,
            fontWeight: '700',
            color: t.color.ink,
          }}
        >
          {value}
        </Text>
        {unit && <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>{unit}</Text>}
      </View>
    </View>
  )
}
