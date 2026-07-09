import { Pressable, View } from 'react-native'
import { Text } from '../components/core/Text'
import { useTheme } from '../theme/ThemeProvider'

/**
 * The header for a drill-down screen (ux-vision §3): a back affordance to the
 * parent surface plus the screen title. Drill-downs aren't in the tab bar, so
 * `onBack` returns through the shell's active-screen model — no separate
 * navigation stack yet (that lands with the split-view phase of #11). `backLabel`
 * names the parent (defaults to the Profile hub).
 */
export function SubScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Profile',
}: {
  readonly title: string
  readonly subtitle?: string
  readonly onBack: () => void
  readonly backLabel?: string
}): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ gap: t.spacing.s2 }}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={`Back to ${backLabel}`}
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: t.touchTarget }}
      >
        <Text style={{ color: t.color.accentText, fontSize: t.fontSize.md, fontWeight: '600' }}>
          {`‹ ${backLabel}`}
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
