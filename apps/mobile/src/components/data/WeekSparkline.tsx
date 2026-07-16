import { View } from 'react-native'
import { Text } from '../core/Text'
import { Sparkline } from './Sparkline'
import { useTheme } from '../../theme/ThemeProvider'

interface WeekSparklineProps {
  readonly label: string
  readonly data: readonly number[]
  readonly max?: number
}

export function WeekSparkline({ label, data }: WeekSparklineProps): React.JSX.Element {
  const t = useTheme()
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <View style={{ gap: t.spacing.s2 }}>
      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, fontWeight: '500' }}>
        {label}
      </Text>
      <Sparkline values={data} height={40} color={t.color.accent} label={`${label} trend`} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {days.map(day => (
          <Text key={day} style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
            {day}
          </Text>
        ))}
      </View>
    </View>
  )
}
