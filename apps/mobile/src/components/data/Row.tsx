import { Pressable, View, type ViewStyle } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Row (data) — list row primitive with optional leading/trailing elements.
 * Touch target: 44pt (or 32pt compact). Padding: s4 (16pt) horizontal, s3 (12pt) vertical.
 * Divider: optional border-bottom on non-last rows (parent responsibility).
 * Tappable rows carry button role; static rows are text.
 */
interface RowProps {
  readonly title: string
  readonly subtitle?: string
  readonly leading?: React.ReactNode
  readonly trailing?: React.ReactNode
  readonly onPress?: () => void
}

export function Row({ title, subtitle, leading, trailing, onPress }: RowProps): React.JSX.Element {
  const t = useTheme()

  const body = (
    <>
      {leading !== undefined && <View>{leading}</View>}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle !== undefined && (
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing !== undefined && <View>{trailing}</View>}
    </>
  )

  const layout: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: t.touchTarget,
    paddingVertical: t.spacing.s3,
    paddingHorizontal: t.spacing.s4,
    gap: t.spacing.s3,
  }

  if (onPress === undefined) {
    return <View style={layout}>{body}</View>
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({ ...layout, opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  )
}
