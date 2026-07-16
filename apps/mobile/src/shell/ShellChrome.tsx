import { useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
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
import { useWorktime } from '../hooks/useWorktime'
import { useCatalog } from '../screens/useCatalog'
import { CommandBar } from '../command/CommandBar'
import { buildCommands, type CommandAction } from '../command/commands'
import { SCREEN_TITLES } from './titles'

/** The Command Bar's "Go to" destinations — the primary navigable screens, in order. */
const COMMAND_DESTINATIONS: readonly Screen[] = [
  'today',
  'planner',
  'projects',
  'reports',
  'meetings',
  'assistant',
  'worktime',
  'absences',
  'credits',
  'rates',
  'settings',
  'profile',
]

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
          ? { label: timer.busy ? '…' : 'Resume', onPress: timer.resume }
          : { label: 'Pause', onPress: timer.pause },
        { label: timer.busy ? '…' : 'Punch out', onPress: timer.punchOut },
      ]
    : [{ label: timer.busy ? '…' : 'Punch in', onPress: () => timer.punchIn() }]
  // Command Bar (design v10 §D11): a global palette wired to the real timer, punch
  // clock, catalog projects and navigation. ⌘K / Ctrl-K opens it on web; a trigger
  // pill opens it everywhere. Its actions dispatch to the same seams the screens use.
  const worktime = useWorktime()
  const catalog = useCatalog()
  const [cmdOpen, setCmdOpen] = useState(false)
  const commands = useMemo(
    () =>
      buildCommands({
        timerRunning: timer.running !== null,
        timerPaused: timer.paused,
        punchedIn: worktime.running !== null,
        projects: (catalog.data ?? []).flatMap(c =>
          c.projects.map(p => ({ id: p.id, name: p.name })),
        ),
        destinations: COMMAND_DESTINATIONS.map(screen => ({
          screen,
          title: SCREEN_TITLES[screen],
        })),
      }),
    [timer.running, timer.paused, worktime.running, catalog.data],
  )
  const runCommand = (action: CommandAction): void => {
    switch (action.type) {
      case 'timer-start':
        timer.punchIn()
        break
      case 'timer-pause':
        timer.pause()
        break
      case 'timer-resume':
        timer.resume()
        break
      case 'timer-stop':
        timer.punchOut()
        break
      case 'clock-in':
        worktime.clockIn()
        break
      case 'clock-out':
        worktime.clockOut()
        break
      case 'start-project':
        timer.punchIn({ projectId: action.projectId })
        break
      case 'navigate':
        go(action.screen)
        break
    }
  }

  // ⌘K / Ctrl-K opens the palette on web (native uses the trigger pill).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setCmdOpen(o => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const commandUi = (
    <>
      <Pressable
        onPress={() => setCmdOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open command bar"
        style={[
          styles.cmdTrigger,
          { backgroundColor: t.color.surface, borderColor: t.color.border },
        ]}
      >
        <Text
          style={{
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize['2xs'],
            color: t.color.ink2,
          }}
        >
          {Platform.OS === 'web' ? '⌘K' : 'Actions'}
        </Text>
      </Pressable>
      <CommandBar
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        commands={commands}
        onRun={runCommand}
      />
    </>
  )

  const islandFor = (posture: 'floating' | 'docked'): React.JSX.Element | null =>
    active === 'today' ? null : (
      <Island
        posture={posture}
        running={timer.running !== null}
        elapsed={timer.elapsed}
        {...(timer.running ? { startedAt: timer.running.startedAt } : {})}
        accumulatedMs={timer.accumulatedMs}
        pausedSinceMs={timer.pausedSinceMs}
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
        {commandUi}
      </View>
    )
  }

  const floatingIsland = islandFor('floating')
  return (
    <View style={[styles.fill, { backgroundColor: t.color.bg }]}>
      <View style={styles.content}>
        <Slot />
      </View>
      {commandUi}
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
  // The ⌘K trigger pill sits bottom-right, clear of the tab bar and the Island.
  cmdTrigger: {
    position: 'absolute',
    right: 16,
    bottom: 92,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
})
