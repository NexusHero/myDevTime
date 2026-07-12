import { ScrollView, View } from 'react-native'
import { useTheme } from '../../theme/ThemeProvider'

interface ScreenScaffoldProps {
  /** Fixed chrome that stays put while the body scrolls (title, hero, tabs). */
  readonly header: React.ReactNode
  /** The single scrolling pane — the only part whose height grows with data. */
  readonly children: React.ReactNode
  /** Disables the ScrollView wrapper so you can pass a FlashList/FlatList instead. */
  readonly disableScroll?: boolean
}

/**
 * The bounded-screen frame (ADR-0035 / design v1): a **fixed** header and exactly
 * **one** internal scroll pane. The screen's title/hero never scroll away, and the
 * body is the only region whose height depends on the data — so the page's scroll
 * depth is bounded to that pane, never the whole viewport. Screens compose this
 * instead of wrapping everything in one ScrollView.
 */
export function ScreenScaffold({
  header,
  children,
  disableScroll = false,
}: ScreenScaffoldProps): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: t.color.bg }}>
      <View
        style={{
          paddingTop: t.spacing.s5,
          paddingHorizontal: t.spacing.s5,
          paddingBottom: t.spacing.s3,
        }}
      >
        {header}
      </View>
      {disableScroll ? (
        <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
      ) : (
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{
            paddingHorizontal: t.spacing.s5,
            paddingBottom: t.spacing.s5,
            gap: t.spacing.s4,
          }}
        >
          {children}
        </ScrollView>
      )}
    </View>
  )
}
