import { View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'
import { useSeviWatch } from '../../hooks/useSeviWatch'

/**
 * SeviWatch — Sevi's calm, non-modal inline voice on Today (ADR-0071, REQ-067/069).
 * Renders nothing at all until the deterministic nudge policy delivers (or a held
 * digest resolves); a delivered line is a single quiet row, `role="status"` with
 * the reason as its accessible name, so screen readers announce it politely and
 * the acceptance specs find it by role + name. Deliberately static — no motion,
 * no gradient (Sevi's watch is deterministic, never an AI proposal, ADR-0005), so
 * reduced-motion needs nothing switched off. No "Ask Sevi" action here: the
 * Assistant overlay's open state lives inside ShellChrome (its ✦ button / ⌘K
 * palette) and no callback or command seam reaches screen content — threading a
 * new prop through the shell for a ghost button would outweigh the shortcut, so
 * the overlay stays one tap away on the shell instead.
 */
export function SeviWatch(): React.JSX.Element | null {
  const t = useTheme()
  const watch = useSeviWatch()

  if (!watch.visible || watch.message === null) return null

  return (
    <View
      role="status"
      accessibilityLabel={watch.message}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: t.spacing.s3,
        paddingVertical: t.spacing.s3,
        paddingHorizontal: t.spacing.s4,
        borderRadius: t.radius.card,
        borderWidth: 1,
        borderColor: t.color.border,
        backgroundColor: t.color.surface,
      }}
    >
      <Text style={{ fontSize: t.fontSize.xs, fontWeight: '700', color: t.color.ink2 }}>Sevi</Text>
      <Text style={{ flex: 1, minWidth: 180, fontSize: t.fontSize.sm, color: t.color.ink }}>
        {watch.message}
      </Text>
    </View>
  )
}
