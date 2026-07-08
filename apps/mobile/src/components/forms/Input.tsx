import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { useTheme } from '../../theme/ThemeProvider.js'

/**
 * Input (form) — labeled text field with an error state and an optional mono
 * variant (durations/amounts render tabular — ux-vision §4). Focus draws the
 * accent border (the soft glow ring is web-only). Ported from the design `Input`.
 */
interface InputProps {
  readonly label?: string
  readonly placeholder?: string
  readonly value?: string
  readonly onChangeText?: (text: string) => void
  readonly mono?: boolean
  readonly error?: string
  readonly secureTextEntry?: boolean
  readonly keyboardType?: 'default' | 'email-address' | 'numeric'
}

export function Input({
  label,
  placeholder = '',
  value = '',
  onChangeText,
  mono = false,
  error,
  secureTextEntry = false,
  keyboardType = 'default',
}: InputProps): React.JSX.Element {
  const t = useTheme()
  const [focused, setFocused] = useState(false)
  const borderColor =
    error !== undefined ? t.color.crit : focused ? t.color.accent : t.color.borderStrong

  return (
    <View style={{ gap: t.spacing.s1 + 2 }}>
      {label !== undefined && (
        <Text style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: t.color.ink2 }}>
          {label}
        </Text>
      )}
      <TextInput
        value={value}
        onChangeText={text => onChangeText?.(text)}
        placeholder={placeholder}
        placeholderTextColor={t.color.ink3}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label ?? placeholder}
        style={{
          height: t.touchTarget,
          paddingHorizontal: t.spacing.s3 + 2,
          borderRadius: t.radius.block,
          borderWidth: 1,
          borderColor,
          backgroundColor: t.color.surface,
          color: t.color.ink,
          fontFamily: mono ? t.fontFamily.numeric : t.fontFamily.ui,
          fontSize: t.fontSize.base,
        }}
      />
      {error !== undefined && (
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.crit }}>{error}</Text>
      )}
    </View>
  )
}
