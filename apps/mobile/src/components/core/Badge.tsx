import { View } from 'react-native'
import { Text } from './Text'
import type { Theme } from '@mydevtime/design'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Badge (core) — a small pill carrying a status tone. Ported from the design
 * system's `Badge`. Tone is carried by color/shape, never emoji (brand voice).
 * Sizes: sm (xs text), md (sm text), lg (md text).
 */
type Tone = 'neutral' | 'accent' | 'good' | 'crit' | 'warn'
type Size = 'sm' | 'md' | 'lg'

interface BadgeProps {
  readonly children: string
  readonly tone?: Tone
  readonly size?: Size
}

function toneColors(t: Theme): Record<Tone, { bg: string; fg: string }> {
  return {
    neutral: { bg: t.color.sunk, fg: t.color.ink2 },
    accent: { bg: t.color.accentSoft, fg: t.color.accentText },
    good: { bg: t.color.goodSoft, fg: t.color.good },
    crit: { bg: t.color.critSoft, fg: t.color.crit },
    warn: { bg: t.color.warnSoft, fg: t.color.warn },
  }
}

function sizeSpec(size: Size, t: Theme) {
  const fontSizeMap = { sm: t.fontSize.xs, md: t.fontSize.sm, lg: t.fontSize.md }
  return { fontSize: fontSizeMap[size], padV: t.spacing.s1, padH: t.spacing.s2 }
}

export function Badge({ children, tone = 'neutral', size = 'md' }: BadgeProps): React.JSX.Element {
  const t = useTheme()
  const c = toneColors(t)[tone]
  const { fontSize, padV, padH } = sizeSpec(size, t)
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingVertical: padV,
        paddingHorizontal: padH,
        borderRadius: t.radius.chip,
        backgroundColor: c.bg,
      }}
    >
      <Text style={{ fontSize, fontWeight: '600', color: c.fg }}>{children}</Text>
    </View>
  )
}
