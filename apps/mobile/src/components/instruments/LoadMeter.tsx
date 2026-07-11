import { View } from 'react-native'
import { Text } from '../core/Text'
import { ProgressBar } from '../data/ProgressBar'
import { useTheme } from '../../theme/ThemeProvider'

interface LoadMeterProps {
  readonly label: string
  readonly value: number
  readonly max?: number
}

export function LoadMeter({ label, value, max = 100 }: LoadMeterProps): React.JSX.Element {
  const t = useTheme()
  const percentage = (value / max) * 100

  return (
    <View style={{ gap: t.spacing.s2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>{label}</Text>
        <Text
          style={{ fontFamily: t.fontFamily.numeric, fontSize: t.fontSize.xs, color: t.color.ink }}
        >
          {Math.round(percentage)}%
        </Text>
      </View>
      <ProgressBar ratio={value / max} label={label} />
    </View>
  )
}
