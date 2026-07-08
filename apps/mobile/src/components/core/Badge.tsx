import { Text, View } from 'react-native'
import type { Theme } from '@mydevtime/design'
import { useTheme } from '../../theme/ThemeProvider.js'

/**
 * Badge (core) — a small pill carrying a status tone. Ported from the design
 * system's `Badge`. Tone is carried by color/shape, never emoji (brand voice).
 */
type Tone = 'neutral' | 'accent' | 'good' | 'crit' | 'warn'

interface BadgeProps {
  readonly children: string
  readonly tone?: Tone
  readonly size?: 'sm' | 'md'
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

export function Badge({ children, tone = 'neutral', size = 'md' }: BadgeProps): React.JSX.Element {
  const t = useTheme()
  const c = toneColors(t)[tone]
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingVertical: size === 'sm' ? 2 : 4,
        paddingHorizontal: size === 'sm' ? 8 : 10,
        borderRadius: t.radius.pill,
        backgroundColor: c.bg,
      }}
    >
      <Text
        style={{
          fontSize: size === 'sm' ? t.fontSize.xs : t.fontSize.sm,
          fontWeight: '600',
          color: c.fg,
        }}
      >
        {children}
      </Text>
    </View>
  )
}
