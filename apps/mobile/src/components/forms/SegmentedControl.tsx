import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { focusRingStyle } from '../core/focusRing'
import { useTheme } from '../../theme/ThemeProvider'

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
  // Which segment holds keyboard focus (REQ-043) — at most one at a time.
  const [focusedValue, setFocusedValue] = useState<T | null>(null)

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.color.sunk,
        borderRadius: 8,
        padding: 2,
      }}
    >
      {segments.map(seg => {
        const on = seg.value === active
        return (
          <Pressable
            key={seg.value}
            onPress={() => onChange(seg.value)}
            onFocus={() => setFocusedValue(seg.value)}
            onBlur={() => setFocusedValue(v => (v === seg.value ? null : v))}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={seg.label}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: t.spacing.s2,
              backgroundColor: on ? t.color.surface : 'transparent',
              borderRadius: 6,
              borderWidth: 1,
              borderColor: on ? t.color.border : 'transparent',
              shadowColor: '#000',
              shadowOpacity: on ? 0.04 : 0,
              shadowRadius: 1,
              shadowOffset: { width: 0, height: 1 },
              elevation: on ? 1 : 0,
              // Visible keyboard focus (REQ-043): web-only accent ring.
              ...focusRingStyle(t, focusedValue === seg.value),
            }}
          >
            <Text
              style={{
                fontSize: t.fontSize.sm,
                fontWeight: on ? '600' : '500',
                color: on ? t.color.ink : t.color.ink2,
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
