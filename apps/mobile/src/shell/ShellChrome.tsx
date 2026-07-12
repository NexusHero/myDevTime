import { useState } from 'react'
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import { Slot, usePathname, useRouter } from 'expo-router'
import { Text } from '../components/core/Text'
import {
  PHONE_TABS,
  SIDEBAR_ITEMS,
  buildPath,
  chromeForWidth,
  parsePath,
  type Screen,
} from '@mydevtime/design'
import { useTheme } from '../theme/ThemeProvider'
import { Island, type IslandAction } from '../components/index'
import { useTimerContext } from '../timer/TimerContext'
import { SCREEN_TITLES } from './titles'

/**
 * The responsive navigation chrome (issue #11), now a persistent Expo Router
 * layout (ADR-0045). It wraps `<Slot />` — so the tab/sidebar bar and the Island
 * stay mounted while the routed screen below them changes — reads the viewport
 * width for the chrome (tabs on phone, sidebar on tablet/web from
 * `@mydevtime/design`), derives the active item from the URL via `parsePath`, and
 * navigates by pushing real paths (`buildPath`). The nav model is still the single
 * source of truth; the chrome just draws it and maps it onto URLs.
 */
export function ShellChrome(): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const router = useRouter()
  const pathname = usePathname()
  const chrome = chromeForWidth(width)
  const items: readonly Screen[] = chrome.navMode === 'tabs' ? PHONE_TABS : SIDEBAR_ITEMS
  const active: Screen = parsePath(pathname)?.screen ?? 'today'
  const go = (screen: Screen): void => {
    router.push(buildPath(screen))
  }

  // One shared timer drives the persistent Island. It shows on every screen EXCEPT
  // Today, where the hero tracker carries the clock — never two clocks (design v2).
  const timer = useTimerContext()
  const [islandExpanded, setIslandExpanded] = useState(false)
  const timerActive = timer.running !== null || timer.paused
  const islandActions: readonly IslandAction[] = timerActive
    ? [
        timer.paused
          ? { label: timer.busy ? '…' : 'Weiter', onPress: timer.resume }
          : { label: 'Pause', onPress: timer.pause },
        { label: timer.busy ? '…' : 'Ausstempeln', onPress: timer.punchOut },
      ]
    : [{ label: timer.busy ? '…' : 'Einstempeln', onPress: () => timer.punchIn() }]
  const islandFor = (posture: 'floating' | 'docked'): React.JSX.Element | null =>
    active === 'today' ? null : (
      <Island
        posture={posture}
        running={timer.running !== null}
        elapsed={timer.elapsed}
        {...(timer.running ? { startedAt: timer.running.startedAt } : {})}
        accumulatedMs={timer.accumulatedMs}
        punched={timerActive}
        expanded={islandExpanded}
        onToggle={() => setIslandExpanded(e => !e)}
        actions={islandActions}
      />
    )

  const nav = items.map(screen => {
    const on = screen === active
    return (
      <Pressable
        key={screen}
        onPress={() => go(screen)}
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
    const dockedIsland = islandFor('docked')
    return (
      <View style={[styles.row, { backgroundColor: t.color.bg }]}>
        <View
          style={[
            styles.sidebar,
            { backgroundColor: t.color.surface, borderRightColor: t.color.border },
          ]}
        >
          {nav}
          {/* The Island docks in the sidebar footer — always visible, never over
              the working surface (design v2). Hidden on Today (hero tracker). */}
          {dockedIsland && <View style={styles.dock}>{dockedIsland}</View>}
        </View>
        <View style={styles.content}>
          <Slot />
        </View>
      </View>
    )
  }

  const floatingIsland = islandFor('floating')
  return (
    <View style={[styles.fill, { backgroundColor: t.color.bg }]}>
      <View style={styles.content}>
        <Slot />
      </View>
      {/* Floating pill, thumb-reachable above the tab bar (design v2). */}
      {floatingIsland && (
        <View style={styles.floatWrap} pointerEvents="box-none">
          {floatingIsland}
        </View>
      )}
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
  // Viewport-locked content pane (bounded-screens, ADR-0035/design v1): the shell
  // never scrolls — each screen owns its internal scroll pane, and this clips so a
  // screen's height can never push the chrome off-viewport.
  content: { flex: 1, minWidth: 0, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 200, paddingTop: 48, borderRightWidth: 1, gap: 4, paddingHorizontal: 8 },
  dock: { marginTop: 'auto', paddingTop: 12 },
  floatWrap: { position: 'absolute', bottom: 84, left: 0, right: 0, alignItems: 'center' },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingVertical: 8 },
  navItemSidebar: { alignItems: 'flex-start', flex: 0, paddingHorizontal: 12, borderRadius: 8 },
  tabbar: { flexDirection: 'row', borderTopWidth: 1, paddingBottom: 24, paddingTop: 6 },
})
