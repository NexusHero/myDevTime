import { Pressable, type ViewStyle } from 'react-native'
import { useTheme } from '../../theme/ThemeProvider.js'

/**
 * IconButton (core) — a square, pill-radius tap target for a single glyph. Always
 * meets the 44-pt touch floor (ux-vision §4). Ported from the design system's
 * `IconButton`.
 */
interface IconButtonProps {
  readonly icon: React.ReactNode
  readonly label: string
  readonly variant?: 'ghost' | 'filled'
  readonly active?: boolean
  readonly onPress?: () => void
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  active = false,
  onPress,
}: IconButtonProps): React.JSX.Element {
  const t = useTheme()
  const filled = variant === 'filled'

  const style = ({ pressed }: { pressed: boolean }): ViewStyle => ({
    width: t.touchTarget,
    height: t.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.pill,
    borderWidth: filled ? 1 : 0,
    borderColor: filled ? t.color.border : 'transparent',
    backgroundColor: filled ? t.color.raised : active ? t.color.accentSoft : 'transparent',
    opacity: pressed ? 0.7 : 1,
  })

  return (
    <Pressable
      onPress={() => onPress?.()}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={style}
    >
      {icon}
    </Pressable>
  )
}
