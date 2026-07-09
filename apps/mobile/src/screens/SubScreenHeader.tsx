import { Pressable, View } from 'react-native'
import { Text } from '../components/core/Text'
import { useTheme } from '../theme/ThemeProvider'

/**
 * The header for a Profile drill-down (ux-vision §3): a back affordance to the
 * hub plus the screen title. Sub-screens (absences/credits/settings) aren't in
 * the tab bar, so `onBack` returns to Profile through the shell's active-screen
 * model — no separate navigation stack yet (that lands with the split-view phase
 * of #11).
 */
export function SubScreenHeader({
  title,
  subtitle,
  onBack,
}: {
  readonly title: string
  readonly subtitle?: string
  readonly onBack: () => void
}): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ gap: t.spacing.s2 }}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to Profile"
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: t.touchTarget }}
      >
        <Text style={{ color: t.color.accentText, fontSize: t.fontSize.md, fontWeight: '600' }}>
          ‹ Profile
        </Text>
      </Pressable>
      <Text
        style={{
          fontWeight: '700',
          fontSize: t.fontSize.xl,
          color: t.color.ink,
          fontFamily: t.fontFamily.display,
        }}
      >
        {title}
      </Text>
      {subtitle !== undefined && (
        <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2, marginTop: -2 }}>
          {subtitle}
        </Text>
      )}
    </View>
  )
}
