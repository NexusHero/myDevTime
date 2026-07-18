import { useState } from 'react'
import { Pressable, View, type ViewStyle } from 'react-native'
import { Text } from '../core/Text'
import { focusRingStyle } from '../core/focusRing'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Row (data) — the list-row primitive (issue #11 core set): an optional leading
 * element, a title + optional subtitle, and an optional trailing element (value,
 * badge, switch, or chevron). Tappable rows honor the 44-pt touch floor and carry
 * a button role; static rows render without one. Used across Profile/settings and
 * any entity list.
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
  const [focused, setFocused] = useState(false)

  const body = (
    <>
      {leading !== undefined && <View style={{ marginRight: t.spacing.s3 }}>{leading}</View>}
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
      {trailing !== undefined && <View style={{ marginLeft: t.spacing.s3 }}>{trailing}</View>}
    </>
  )

  const layout: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: t.touchTarget,
    paddingVertical: t.spacing.s2,
  }

  if (onPress === undefined) {
    return <View style={layout}>{body}</View>
  }
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        ...layout,
        opacity: pressed ? 0.6 : 1,
        // Visible keyboard focus (REQ-043): web-only accent ring, no unfocused change.
        ...focusRingStyle(t, focused),
      })}
    >
      {body}
    </Pressable>
  )
}
