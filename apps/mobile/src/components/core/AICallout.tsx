import { View } from 'react-native'
import { Text } from './Text'
import { useTheme } from '../../theme/ThemeProvider'

interface AICalloutProps {
  readonly title?: string
  readonly children: React.ReactNode
  readonly action?: React.ReactNode
}

export function AICallout({ title, children, action }: AICalloutProps): React.JSX.Element {
  const t = useTheme()

  return (
    <View
      style={{
        flexDirection: 'row',
        padding: t.spacing.s3,
        borderWidth: 1,
        borderColor: t.color.accent,
        borderRadius: t.radius.card,
        gap: t.spacing.s3,
        alignItems: 'flex-start',
      }}
    >
      <View style={{ flex: 1 }}>
        {title && (
          <Text
            style={{
              fontWeight: '600',
              fontSize: t.fontSize.xs,
              color: t.color.ink,
              marginBottom: t.spacing.s1,
            }}
          >
            {title}
          </Text>
        )}
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>{children}</Text>
      </View>
      {action}
    </View>
  )
}
