import { View } from 'react-native'
import { Gauge } from '../data/Gauge'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

interface OvertimeGaugeProps {
  readonly label: string
  readonly value: number
  readonly max: number
}

export function OvertimeGauge({ label, value, max }: OvertimeGaugeProps): React.JSX.Element {
  const t = useTheme()

  return (
    <View style={{ alignItems: 'center', gap: t.spacing.s3 }}>
      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, fontWeight: '500' }}>
        {label}
      </Text>
      <Gauge value={value} range={max} size={120} />
      <Text
        style={{ fontFamily: t.fontFamily.numeric, fontSize: t.fontSize.sm, color: t.color.ink }}
      >
        {value.toFixed(1)} / {max}h
      </Text>
    </View>
  )
}
