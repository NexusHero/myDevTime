import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

interface CheckboxProps {
  readonly checked: boolean
  readonly onChange?: (next: boolean) => void
  readonly label?: string
  readonly disabled?: boolean
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
}: CheckboxProps): React.JSX.Element {
  const t = useTheme()

  return (
    <Pressable
      onPress={() => !disabled && onChange?.(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label ?? 'checkbox'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.s3,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: checked ? t.color.accent : t.color.border,
          backgroundColor: checked ? t.color.accent : 'transparent',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {checked && (
          <Text style={{ fontSize: 12, fontWeight: '700', color: t.color.accentInk }}>✓</Text>
        )}
      </View>
      {label && <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink }}>{label}</Text>}
    </Pressable>
  )
}
