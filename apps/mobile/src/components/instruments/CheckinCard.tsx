import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { Card } from '../core/Card'
import { useTheme } from '../../theme/ThemeProvider'

interface CheckinCardProps {
  readonly label: string
  readonly checked: boolean
  readonly onPress?: () => void
}

export function CheckinCard({ label, checked, onPress }: CheckinCardProps): React.JSX.Element {
  const t = useTheme()

  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: checked ? t.color.good : t.color.border,
            }}
          />
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink, flex: 1 }}>{label}</Text>
        </View>
      </Card>
    </Pressable>
  )
}
