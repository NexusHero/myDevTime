import { View, TextInput } from 'react-native'
import { Button } from './Button'
import { useTheme } from '../../theme/ThemeProvider'

interface AIAskBarProps {
  readonly value: string
  readonly onChange?: (text: string) => void
  readonly onSubmit?: () => void
  readonly placeholder?: string
}

export function AIAskBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Ask AI...',
}: AIAskBarProps): React.JSX.Element {
  const t = useTheme()

  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.s2, alignItems: 'center' }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.color.ink3}
        style={{
          flex: 1,
          padding: t.spacing.s3,
          borderRadius: t.radius.block,
          borderWidth: 1,
          borderColor: t.color.border,
          backgroundColor: t.color.surface,
          fontSize: t.fontSize.sm,
          color: t.color.ink,
        }}
      />
      <Button size="sm" onPress={() => onSubmit?.()}>
        Ask
      </Button>
    </View>
  )
}
