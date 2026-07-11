import { Pressable } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

export interface SelectOption {
  readonly value: string
  readonly label: string
}

interface SelectProps {
  readonly options: readonly SelectOption[]
  readonly value: string
  readonly onChange?: (value: string) => void
  readonly placeholder?: string
  readonly disabled?: boolean
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
}: SelectProps): React.JSX.Element {
  const t = useTheme()
  const selected = options.find(o => o.value === value)

  return (
    <Pressable
      onPress={() => onChange?.(options[0]?.value ?? '')}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={placeholder}
      style={{
        padding: t.spacing.s3,
        borderRadius: t.radius.block,
        borderWidth: 1,
        borderColor: t.color.border,
        backgroundColor: t.color.surface,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ fontSize: t.fontSize.sm, color: selected ? t.color.ink : t.color.ink2 }}>
        {selected?.label ?? placeholder}
      </Text>
    </Pressable>
  )
}
