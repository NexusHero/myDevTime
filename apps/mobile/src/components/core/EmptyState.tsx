import { View } from 'react-native'
import { Text } from './Text'
import { useTheme } from '../../theme/ThemeProvider'

interface EmptyStateProps {
  readonly title: string
  readonly hint?: string
  readonly action?: React.ReactNode
  readonly compact?: boolean
}

export function EmptyState({
  title,
  hint,
  action,
  compact = false,
}: EmptyStateProps): React.JSX.Element {
  const t = useTheme()

  return (
    <View
      style={{
        alignItems: 'center',
        gap: t.spacing.s3,
        padding: compact ? t.spacing.s4 : t.spacing.s5,
        borderWidth: t.borderWidth.hair,
        borderStyle: 'dashed',
        borderColor: t.color.borderStrong,
        borderRadius: t.radius.xl,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: t.color.accentSoft,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />
      <Text
        style={{
          fontWeight: '600',
          fontSize: t.fontSize.md,
          color: t.color.ink,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {hint && (
        <Text
          style={{
            fontSize: t.fontSize.xs,
            color: t.color.ink2,
            textAlign: 'center',
            maxWidth: 380,
          }}
        >
          {hint}
        </Text>
      )}
      {action}
    </View>
  )
}
