import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Tabs (navigation) — underline tab strip for in-screen section switching
 * (stays boring on purpose — ux-vision §5). Active tab shows accent underline,
 * inactive tabs show no border. Padding: s4 horizontal, s3 vertical.
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
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={it.label}
            style={{
              paddingHorizontal: t.spacing.s4,
              paddingVertical: t.spacing.s3,
              borderBottomWidth: 2,
              borderBottomColor: on ? t.color.accent : 'transparent',
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
