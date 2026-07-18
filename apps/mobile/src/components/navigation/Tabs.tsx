import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { focusRingStyle } from '../core/focusRing'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Tabs (navigation) — an underline tab strip for in-screen section switching
 * (stays boring on purpose — ux-vision §5). Ported from the design `Tabs`.
 */
export interface TabItem {
  readonly value: string
  readonly label: string
}

interface TabsProps {
  readonly items: readonly TabItem[]
  readonly active: string
  readonly onChange?: (value: string) => void
}

export function Tabs({ items, active, onChange }: TabsProps): React.JSX.Element {
  const t = useTheme()
  // Which tab holds keyboard focus (REQ-043) — at most one at a time.
  const [focusedValue, setFocusedValue] = useState<string | null>(null)
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: t.spacing.s5,
        borderBottomWidth: 1,
        borderBottomColor: t.color.border,
      }}
    >
      {items.map(it => {
        const on = it.value === active
        return (
          <Pressable
            key={it.value}
            onPress={() => onChange?.(it.value)}
            onFocus={() => setFocusedValue(it.value)}
            onBlur={() => setFocusedValue(v => (v === it.value ? null : v))}
            // A `tab` role requires a `tablist` parent + `aria-selected`, which
            // react-native-web does not emit from `accessibilityState` — so axe
            // fails it (REQ-043). `button` conveys the switch without those attrs.
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={it.label}
            style={{
              paddingVertical: t.spacing.s3 - 2,
              borderBottomWidth: 2,
              borderBottomColor: on ? t.color.accent : 'transparent',
              // Visible keyboard focus (REQ-043): web-only accent ring.
              ...focusRingStyle(t, focusedValue === it.value),
            }}
          >
            <Text
              style={{
                fontSize: t.fontSize.sm,
                fontWeight: '600',
                color: on ? t.color.ink : t.color.ink2,
              }}
            >
              {it.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
