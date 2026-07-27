import { useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import { Slot, usePathname, useRouter } from 'expo-router'
import { Text } from '../components/core/Text'
import { useToast } from '../components/core/Toast'
import type { StartTimerInput } from '../api/timer'
import {
  PHONE_TABS,
  SIDEBAR_ITEMS,
  buildPath,
  chromeForWidth,
  parsePath,
  type Screen,
} from '@mydevtime/design'
import { useTheme } from '../theme/ThemeProvider'
import { Icon, Island, type IslandAction } from '../components/index'
import { LiveMark } from '../components/canvas/LiveMark'
import { AssistantOverlay } from '../components/assistant/AssistantOverlay'
import { initialsOf, useSessionContext } from './SessionContext'
import { useTimerContext } from '../timer/TimerContext'
import { usePomodoro } from '../focus/PomodoroContext'
import { useWorktime } from '../hooks/useWorktime'
import { useCatalog } from '../screens/useCatalog'
import { CommandBar } from '../command/CommandBar'
import { buildCommands, type CommandAction } from '../command/commands'
import { SCREEN_TITLES } from './titles'

/**
 * The Command Bar's "Go to" destinations — the primary navigable screens, in order.
 * The Assistant is deliberately absent: it is a layer, not a place (ADR-0063), so the
 * palette offers "Open Assistant" (the overlay) instead of routing to a tab.
 */
const COMMAND_DESTINATIONS: readonly Screen[] = [
  'today',
  'planner',
  'projects',
  'reports',
  'meetings',
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
/** Milliseconds as `MM:SS` for the Island's focus-mode countdown. */
function pomodoroMmss(ms: number): string {
  const total = ms > 0 ? Math.floor(ms / 1000) : 0
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(Math.floor(total / 60))}:${p(total % 60)}`
}

export function ShellChrome(): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const router = useRouter()
  const pathname = usePathname()
  const chrome = chromeForWidth(width)
  const items: readonly Screen[] = chrome.navMode === 'tabs' ? PHONE_TABS : SIDEBAR_ITEMS
  // The calendar is the stage (design v20): an unresolvable path falls back to the
  // Planner, matching `main.jsx`'s `effScreen` default — never a blank chrome.
  const parsed = parsePath(pathname)?.screen ?? 'planner'
  // Unified Day Canvas (ADR-0075): the Today tab is retired — `/today` redirects to
  // `/planner` so deep links, OS quick actions (REQ-039), and the command bar keep
  // working. The Screen type keeps 'today' for deep-link compatibility; it is just no
  // longer a tab or sidebar item.
  const active: Screen = parsed === 'today' ? 'planner' : parsed
  const go = (screen: Screen): void => {
    router.push(buildPath(screen))
  }
  useEffect(() => {
    if (parsed === 'today') {
      router.replace(buildPath('planner'))
    }
  }, [parsed, router])

  // Profile is "me", not a peer place (calendar-centric IA, ADR-0063): the sidebar
  // pins it as an avatar in the footer rather than as a rail item. Initials + name
  // come from the live session — never a fabricated user.
  const session = useSessionContext()
  const profileInitials = session.user ? initialsOf(session.user) : '·'
  const profileName = session.user?.name.trim() || session.user?.email || 'Profile'

  // One shared timer drives the persistent Island. It shows on every screen EXCEPT
  // Today, where the hero tracker carries the clock — never two clocks (design v2).
  const timer = useTimerContext()
  const pomodoro = usePomodoro()
  const [islandExpanded, setIslandExpanded] = useState(false)
  const timerActive = timer.running !== null || timer.paused

  // Design v20 confirmations: every start / stop / pause / clock action lands a
  // transient toast (the pill from `Toast.tsx`). The wrappers only add feedback —
  // the underlying timer/punch-clock behaviour is untouched — and both the Island
  // and the Command Bar dispatch through them, so the confirmation is consistent
  // wherever the action is triggered. English copy (UI is English-only).
  const toast = useToast()
  const startTimer = (input?: StartTimerInput, label?: string): void => {
    timer.punchIn(input)
    toast.show(label != null ? `Timer running on ${label}.` : 'Timer running.')
  }
  const stopTimer = (): void => {
    const tracked = timer.elapsed // snapshot before the optimistic clear
    timer.punchOut()
    toast.show(`Timer stopped — ${tracked} tracked.`)
  }
  const pauseTimer = (): void => {
    timer.pause()
    toast.show('Timer paused.')
  }
  const resumeTimer = (): void => {
    timer.resume()
    toast.show('Timer resumed.')
  }

  const islandActions: readonly IslandAction[] = timerActive
    ? [
        timer.paused
          ? { label: timer.busy ? '…' : 'Resume', onPress: resumeTimer }
          : { label: 'Pause', onPress: pauseTimer },
        { label: timer.busy ? '…' : 'Punch out', onPress: stopTimer },
      ]
    : [{ label: timer.busy ? '…' : 'Punch in', onPress: () => startTimer() }]
  // Command Bar (design v10 §D11): a global palette wired to the real timer, punch
  // clock, catalog projects and navigation. ⌘K / Ctrl-K opens it on web; a trigger
  // pill opens it everywhere. Its actions dispatch to the same seams the screens use.
  const worktime = useWorktime()
  const catalog = useCatalog()
  const clockIn = (): void => {
    worktime.clockIn()
    toast.show('Clocked in.')
  }
  const clockOut = (): void => {
    worktime.clockOut()
    toast.show('Clocked out.')
  }
  const [cmdOpen, setCmdOpen] = useState(false)
  // The Assistant overlay (ADR-0063): opened by the ✦ button or ⌘K, floats over the
  // current screen — a layer, not a place.
  const [assistantOpen, setAssistantOpen] = useState(false)
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
        startTimer()
        break
      case 'timer-pause':
        pauseTimer()
        break
      case 'timer-resume':
        resumeTimer()
        break
      case 'timer-stop':
        stopTimer()
        break
      case 'clock-in':
        clockIn()
        break
      case 'clock-out':
        clockOut()
        break
      case 'start-project': {
        const name = (catalog.data ?? [])
          .flatMap(c => c.projects)
          .find(p => p.id === action.projectId)?.name
        startTimer({ projectId: action.projectId }, name)
        break
      }
      case 'navigate':
        go(action.screen)
        break
      case 'open-assistant':
        setAssistantOpen(true)
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
      {/* The ✦ button opens the Assistant overlay — a layer, not a place (ADR-0063),
          sat just above the ⌘K pill. Both reach the same grounded, read-only chat. */}
      <Pressable
        onPress={() => setAssistantOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open assistant"
        style={[styles.aiTrigger, { backgroundColor: t.color.accent }]}
      >
        <Icon name="assistant" size={18} color={t.color.accentInk} />
      </Pressable>
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
      <AssistantOverlay open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <CommandBar
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        commands={commands}
        onRun={runCommand}
      />
    </>
  )

  // Focus mode (REQ-032): when a Pomodoro runs, the Island carries its phase + countdown
  // on every screen, so the cadence stays glanceable away from Today.
  const focusBadge = pomodoro.active
    ? {
        label:
          pomodoro.phase === 'focus'
            ? 'Focus'
            : pomodoro.phase === 'longBreak'
              ? 'Long break'
              : 'Break',
        remaining: pomodoroMmss(pomodoro.remainingMs),
      }
    : null

  const islandFor = (posture: 'floating' | 'docked'): React.JSX.Element | null => (
    <Island
      posture={posture}
      running={timer.running !== null}
      elapsed={timer.elapsed}
      {...(timer.running ? { startedAt: timer.running.startedAt } : {})}
      accumulatedMs={timer.accumulatedMs}
      pausedSinceMs={timer.pausedSinceMs}
      punched={timerActive}
      focus={focusBadge}
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
        // The shell nav switches routes, so these are navigation links, not tabs —
        // a `tab` role (react-native-web doesn't emit `aria-selected`) fails axe's
        // aria-required-attr/parent (REQ-043); `link` needs neither.
        accessibilityRole="link"
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
          {/* The living brand mark: its Now-dot blinks idle and pulses while a timer
              runs — the sidebar logo bound to the shared timer state (ADR-0061). */}
          <View style={styles.brand}>
            <LiveMark state={timer.running !== null ? 'tracking' : 'idle'} size={26} />
            <Text
              style={{
                fontFamily: t.fontFamily.display,
                fontSize: t.fontSize.md,
                color: t.color.ink,
              }}
            >
              myDevTime
            </Text>
          </View>
          {nav}
          {/* Footer pinned to the bottom (calendar-centric IA, ADR-0063): the docked
              Island over the Profile avatar. The Island is always visible, never over
              the working surface (design v2), and hidden on Today (hero tracker). The
              avatar is "me" — Profile & Settings — not a peer place in the rail. */}
          <View style={styles.footer}>
            {dockedIsland && <View style={styles.dock}>{dockedIsland}</View>}
            <Pressable
              onPress={() => go('profile')}
              accessibilityRole="link"
              accessibilityState={{ selected: active === 'profile' }}
              accessibilityLabel="Profile and settings"
              style={[
                styles.avatarRow,
                { minHeight: t.touchTarget },
                active === 'profile' && { backgroundColor: t.color.accentSoft },
              ]}
            >
              <View style={[styles.avatarDisc, { backgroundColor: t.color.accent }]}>
                <Text
                  style={{
                    fontFamily: t.fontFamily.numeric,
                    fontSize: t.fontSize['2xs'],
                    fontWeight: '700',
                    color: t.color.accentInk,
                  }}
                >
                  {profileInitials}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: t.fontSize.sm,
                    fontWeight: '600',
                    color: active === 'profile' ? t.color.accentText : t.color.ink,
                  }}
                >
                  {profileName}
                </Text>
                <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>
                  Profile & Settings
                </Text>
              </View>
            </Pressable>
          </View>
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
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  footer: { marginTop: 'auto' },
  dock: { paddingTop: 12 },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 8,
  },
  avatarDisc: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  // The ✦ Assistant button sits just above the ⌘K pill (bottom-right stack).
  aiTrigger: {
    position: 'absolute',
    right: 16,
    bottom: 136,
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
