import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * SegmentedControl (form) — tabs within a group (never wider than container).
 * Active segment: accent fill, accent text. Inactive: overlay bg, secondary text.
 * Padding: s3 (12pt) per segment, radius: chip (6pt).
 */
export interface SegmentedControlProps<T extends string> {
  readonly segments: readonly { readonly value: T; readonly label: string }[]
  readonly active: T
  readonly onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({
  segments,
  active,
  onChange,
}: SegmentedControlProps<T>): React.JSX.Element {
  const t = useTheme()

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.color.sunk,
        borderRadius: t.radius.chip,
        padding: 2,
      }}
    >
      {segments.map(seg => {
        const on = seg.value === active
        return (
          <Pressable
            key={seg.value}
            onPress={() => onChange(seg.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={seg.label}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: t.spacing.s3,
              paddingHorizontal: t.spacing.s3,
              backgroundColor: on ? t.color.accent : 'transparent',
              borderRadius: t.radius.chip,
              borderWidth: 0,
            }}
          >
            <Text
              style={{
                fontSize: t.fontSize.sm,
                fontWeight: on ? '600' : '500',
                color: on ? t.color.accentInk : t.color.ink2,
              }}
            >
              {seg.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
