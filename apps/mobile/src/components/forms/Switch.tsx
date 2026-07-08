import { Pressable, Text, View } from 'react-native'
import { useTheme } from '../../theme/ThemeProvider.js'

/**
 * Switch (form) — a custom pill toggle matching the design system's `Switch`
 * (transitions color, never bounces — ux-vision §4). Track colors by accent; the
 * thumb slides between two positions.
 */
interface SwitchProps {
  readonly checked: boolean
  readonly onChange?: (next: boolean) => void
  readonly label?: string
}

export function Switch({ checked, onChange, label }: SwitchProps): React.JSX.Element {
  const t = useTheme()
  return (
    <Pressable
      onPress={() => onChange?.(!checked)}
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      accessibilityLabel={label ?? 'toggle'}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}
    >
      <View
        style={{
          width: 40,
          height: 24,
          borderRadius: t.radius.pill,
          backgroundColor: checked ? t.color.accent : t.color.borderStrong,
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: checked ? 19 : 3,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#ffffff',
          }}
        />
      </View>
      {label !== undefined && (
        <Text style={{ fontSize: t.fontSize.base, color: t.color.ink }}>{label}</Text>
      )}
    </Pressable>
  )
}
