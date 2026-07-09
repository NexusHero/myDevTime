import { View, type ViewStyle } from 'react-native'
import { Text } from './Text'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Card (core) — a raised surface with an optional header (title + subtitle +
 * action). Hairline border, `card` radius (ux-vision §4: "depth via layers, not
 * shadows-everywhere"). Ported from the design system's `Card`.
 */
interface CardProps {
  readonly children?: React.ReactNode
  readonly title?: string
  readonly subtitle?: string
  readonly action?: React.ReactNode
  readonly padding?: boolean
  readonly style?: ViewStyle
}

export function Card({
  children,
  title,
  subtitle,
  action,
  padding = true,
  style,
}: CardProps): React.JSX.Element {
  const t = useTheme()
  const hasHeader = Boolean(title) || Boolean(action)
  return (
    <View
      style={[
        {
          backgroundColor: t.color.raised,
          borderColor: t.color.border,
          borderWidth: 1,
          borderRadius: t.radius.card,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {hasHeader && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: t.spacing.s4,
            paddingVertical: t.spacing.s3,
            borderBottomWidth: 1,
            borderBottomColor: t.color.border,
          }}
        >
          <View style={{ flex: 1 }}>
            {title !== undefined && (
              <Text style={{ fontWeight: '700', fontSize: t.fontSize.md, color: t.color.ink }}>
                {title}
              </Text>
            )}
            {subtitle !== undefined && (
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 2 }}>
                {subtitle}
              </Text>
            )}
          </View>
          {action}
        </View>
      )}
      <View style={{ padding: padding ? t.spacing.s4 : 0 }}>{children}</View>
    </View>
  )
}
