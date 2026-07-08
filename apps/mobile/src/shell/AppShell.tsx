import { useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { PHONE_TABS, SIDEBAR_ITEMS, chromeForWidth, type Screen } from '@mydevtime/design'
import { useTheme } from '../theme/ThemeProvider'
import { ScreenView, SCREEN_TITLES } from './screens'

/**
 * The responsive navigation shell (issue #11). It reads the viewport width, asks
 * `@mydevtime/design` for the chrome (tabs on phone, sidebar on tablet/web), and
 * renders the nav items from that same package's `PHONE_TABS` / `SIDEBAR_ITEMS`
 * — the model is the source of truth, the shell just draws it. Split-view
 * (master–detail) content is a later phase; here each item swaps the active
 * screen.
 */
export function AppShell(): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const chrome = chromeForWidth(width)
  const items: readonly Screen[] = chrome.navMode === 'tabs' ? PHONE_TABS : SIDEBAR_ITEMS
  const [active, setActive] = useState<Screen>('today')

  const nav = items.map(screen => {
    const on = screen === active
    return (
      <Pressable
        key={screen}
        onPress={() => setActive(screen)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={SCREEN_TITLES[screen]}
        style={[
          styles.navItem,
          { minHeight: t.touchTarget },
          chrome.navMode === 'sidebar' && styles.navItemSidebar,
        ]}
      >
        <Text
          style={{
            color: on ? t.color.accentText : t.color.ink2,
            fontWeight: on ? '700' : '500',
            fontSize: t.fontSize.sm,
          }}
        >
          {SCREEN_TITLES[screen]}
        </Text>
      </Pressable>
    )
  })

  if (chrome.navMode === 'sidebar') {
    return (
      <View style={[styles.row, { backgroundColor: t.color.bg }]}>
        <View
          style={[
            styles.sidebar,
            { backgroundColor: t.color.surface, borderRightColor: t.color.border },
          ]}
        >
          {nav}
        </View>
        <View style={styles.fill}>
          <ScreenView screen={active} />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.fill, { backgroundColor: t.color.bg }]}>
      <View style={styles.fill}>
        <ScreenView screen={active} />
      </View>
      <View
        style={[
          styles.tabbar,
          { backgroundColor: t.color.surface, borderTopColor: t.color.border },
        ]}
      >
        {nav}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 200, paddingTop: 48, borderRightWidth: 1, gap: 4, paddingHorizontal: 8 },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingVertical: 8 },
  navItemSidebar: { alignItems: 'flex-start', flex: 0, paddingHorizontal: 12, borderRadius: 8 },
  tabbar: { flexDirection: 'row', borderTopWidth: 1, paddingBottom: 24, paddingTop: 6 },
})
