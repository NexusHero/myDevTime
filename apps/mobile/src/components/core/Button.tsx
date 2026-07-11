import { Pressable, type ViewStyle } from 'react-native'
import { Text } from './Text'
import type { Theme } from '@mydevtime/design'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Button (core) — pill-shaped, four variants. Press feedback dims (ux-vision §4:
 * "never scale up"). Ported from the design system's `Button`.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  readonly children: string
  readonly variant?: Variant
  readonly size?: Size
  readonly icon?: React.ReactNode
  readonly disabled?: boolean
  readonly fullWidth?: boolean
  readonly onPress?: () => void
}

function variantColors(t: Theme): Record<Variant, { bg: string; fg: string; border: string }> {
  return {
    primary: { bg: t.color.accent, fg: t.color.accentInk, border: t.color.accent },
    secondary: { bg: t.color.raised, fg: t.color.ink, border: t.color.borderStrong },
    danger: { bg: t.color.crit, fg: '#ffffff', border: t.color.crit },
    ghost: { bg: 'transparent', fg: t.color.ink2, border: 'transparent' },
  }
}

function sizeSpec(size: Size, t: Theme) {
  // Touch targets: sm=32pt (s2 v-pad), md=44pt (s3 v-pad), lg=56pt (s4 v-pad)
  // H-padding: s3=12pt (sm), s4=16pt (md/lg)
  if (size === 'sm') return { padV: t.spacing.s2, padH: t.spacing.s3, fontSize: t.fontSize.xs }
  if (size === 'lg') return { padV: t.spacing.s4, padH: t.spacing.s4, fontSize: t.fontSize.md }
  return { padV: t.spacing.s3, padH: t.spacing.s4, fontSize: t.fontSize.sm }
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  fullWidth = false,
  onPress,
}: ButtonProps): React.JSX.Element {
  const t = useTheme()
  const c = variantColors(t)[variant]
  const { padV, padH, fontSize } = sizeSpec(size, t)

  const style = ({ pressed }: { pressed: boolean }): ViewStyle => ({
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.s2,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    paddingVertical: padV,
    paddingHorizontal: padH,
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bg,
    opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
  })

  return (
    <Pressable
      onPress={() => onPress?.()}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled }}
      style={style}
    >
      {icon}
      <Text style={{ color: c.fg, fontSize, fontWeight: '600' }}>{children}</Text>
    </Pressable>
  )
}
