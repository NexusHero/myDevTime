import { View } from 'react-native'
import { Text } from './Text'
import { useTheme } from '../../theme/ThemeProvider'

interface AICalloutProps {
  readonly title?: string
  readonly children: React.ReactNode
  readonly action?: React.ReactNode
}

/**
 * A surface that visibly marks its content as an AI proposal (ADR-0005/0034): the
 * soft AI wash, the violet AI-signature ink on the title, and a tri-stop
 * blue→violet→orange rail down the left edge. Deterministic UI never wears this —
 * it is the "this came from AI, you decide" contract. The gradient is rendered
 * dependency-free as three stacked bands so it works on native and web alike.
 */
export function AICallout({ title, children, action }: AICalloutProps): React.JSX.Element {
  const t = useTheme()

  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: t.radius.card,
        backgroundColor: t.color.aiSoft,
        overflow: 'hidden',
        alignItems: 'stretch',
      }}
    >
      <View style={{ width: 3 }}>
        {t.aiGradient.map((stop, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: stop }} />
        ))}
      </View>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          padding: t.spacing.s3,
          gap: t.spacing.s3,
          alignItems: 'flex-start',
        }}
      >
        <View style={{ flex: 1 }}>
          {title && (
            <Text
              style={{
                fontWeight: '700',
                fontSize: t.fontSize.xs,
                color: t.color.aiInk,
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
    </View>
  )
}
