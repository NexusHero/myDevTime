import { View } from 'react-native'
import type { BannerVariant } from '@mydevtime/domain'
import { Text } from '../core/Text'
import { Button } from '../core/Button'
import { useTheme } from '../../theme/ThemeProvider'
import type { Theme } from '@mydevtime/design'

/**
 * The one contextual Planner banner (REQ-059, design v14 §M2). The four variants
 * (conflict · price · healing · note) collapse to **one** component with a `variant` prop;
 * the screen renders **at most one** at a time by running the candidates through the
 * deterministic `pickBanner` (Conflict > Price > Healing > Note). Each variant only changes
 * the left-edge accent — the layout is shared, so the planner never stacks banners.
 */
export interface ContextBannerAction {
  readonly label: string
  readonly onPress: () => void
  readonly variant?: 'primary' | 'ghost'
}

export interface ContextBannerProps {
  readonly variant: BannerVariant
  readonly title: string
  /** Optional secondary line. */
  readonly body?: string
  /** Optional lead glyph (e.g. `✦` for an AI-sourced note). */
  readonly leadGlyph?: string
  readonly actions?: readonly ContextBannerAction[]
}

/** The left-edge accent per variant — conflict is critical, healing is live-orange. */
function edgeColor(t: Theme, variant: BannerVariant): string {
  switch (variant) {
    case 'conflict':
      return t.color.crit
    case 'price':
      return t.color.accent
    case 'healing':
      return t.color.live
    case 'note':
      return t.color.border
  }
}

export function ContextBanner({
  variant,
  title,
  body,
  leadGlyph,
  actions,
}: ContextBannerProps): React.JSX.Element {
  const t = useTheme()
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.s3,
        paddingVertical: t.spacing.s2,
        paddingHorizontal: t.spacing.s3,
        borderRadius: t.radius.block,
        borderWidth: 1,
        borderColor: t.color.border,
        borderLeftWidth: 3,
        borderLeftColor: edgeColor(t, variant),
        backgroundColor: t.color.surface,
        maxWidth: 680,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: t.color.ink }}>
          {leadGlyph !== undefined ? `${leadGlyph} ${title}` : title}
        </Text>
        {body !== undefined && (
          <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2, lineHeight: 16 }}>
            {body}
          </Text>
        )}
      </View>
      {(actions ?? []).map(a => (
        <Button key={a.label} size="sm" variant={a.variant ?? 'primary'} onPress={a.onPress}>
          {a.label}
        </Button>
      ))}
    </View>
  )
}
