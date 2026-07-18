import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { focusRingStyle } from '../core/focusRing'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Switch (form) — a custom pill toggle matching the design system's `Switch`
 * (transitions color, never bounces — ux-vision §4). Track colors by accent; the
 * thumb slides between two positions.
 */
interface SwitchProps {
  readonly checked: boolean
  readonly onChange?: (next: boolean) => void
  /** Visible trailing text. Omit when a sibling (e.g. a Row title) already names it. */
  readonly label?: string
  /** Screen-reader label when there is no visible `label` (falls back to `label`). */
  readonly accessibilityLabel?: string
}

export function Switch({
  checked,
  onChange,
  label,
  accessibilityLabel,
}: SwitchProps): React.JSX.Element {
  const t = useTheme()
  const [focused, setFocused] = useState(false)
  return (
    <Pressable
      onPress={() => onChange?.(!checked)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      // A `switch` role requires `aria-checked`, which react-native-web does not
      // emit from `accessibilityState` — so axe fails it (REQ-043). Present it as a
      // button and fold the on/off state into the accessible name instead.
      accessibilityRole="button"
      accessibilityState={{ checked }}
      accessibilityLabel={`${accessibilityLabel ?? label ?? 'toggle'}, ${checked ? 'on' : 'off'}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.s3,
        // Visible keyboard focus (REQ-043): web-only accent ring, no unfocused change.
        ...focusRingStyle(t, focused),
      }}
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
        <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink }}>{label}</Text>
      )}
    </Pressable>
  )
}
