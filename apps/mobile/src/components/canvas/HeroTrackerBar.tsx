import { Pressable, TextInput, View } from 'react-native'
import { projectColor } from '@mydevtime/design'
import { useTheme } from '../../theme/ThemeProvider'
import { Text } from '../core/Text'
import { Button, LiveButton, PauseCounter, ReanimatedTimer } from '../index'
import type { Project } from '../../screens/projectsData'
import type { TimeEntry } from '../../api/timer'

/**
 * HeroTrackerBar — the reusable hero tracker bar (issue #361), lifted verbatim from
 * [`TodayScreen`](../../screens/TodayScreen.tsx). It is the entire hero unit: the task
 * input, the project chip, the billable € toggle, the worked-time display, the
 * [`PauseCounter`](./PauseCounter.tsx), and the big orange breathing
 * [`LiveButton`](./LiveButton.tsx) start/stop.
 *
 * It is a **controlled view** (ADR-0005 / ux-vision §2.3): every value and callback
 * arrives through props. It owns no timer state and never creates a second clock —
 * the single shared [`TimerContext`](../../timer/TimerContext.tsx) stays the source of
 * truth; the host screen reads it and passes the slice down. Only view code moved;
 * the deterministic core ([`useTimer`](../../hooks/useTimer.ts)) is untouched.
 */
export interface HeroTrackerBarProps {
  /** The task note being typed (controlled input). */
  readonly task: string
  readonly setTask: (next: string) => void
  /** The running entry's resolved project, or null when none is running. */
  readonly runningProject: Project | null
  /** Whether the current/next session is billable (the running entry's flag, else the default). */
  readonly billable: boolean
  /** True while a punch-in/out is in flight (disables the controls). */
  readonly busy: boolean
  /** The running entry, or null. */
  readonly running: TimeEntry | null
  /** Milliseconds banked from previous paused segments this session. */
  readonly accumulatedMs: number
  /** A formatted snapshot of the elapsed time (idle/paused display). */
  readonly elapsed: string
  /** True while the session is paused (no running segment, but time is banked to resume). */
  readonly paused: boolean
  /** When the current pause began (ms epoch), or null when not paused. */
  readonly pausedSinceMs: number | null
  /** The session is "active" (has time on it) whether the segment is running or paused. */
  readonly active: boolean
  /** True only while a segment is actively running (drives the live worked-time colour). */
  readonly isRunning: boolean
  /** Flip billable (patches the running entry live / sets the next-start default). */
  readonly setBillable: (next: boolean) => void
  /** Pause the running segment (persisting it) and hold the context to resume. */
  readonly onPause: () => void
  /** Start a fresh segment from the paused context. */
  readonly onResume: () => void
  /** Start tracking (the host decides the note + toast feedback). */
  readonly onStart: () => void
  /** Stop tracking (the host snapshots the elapsed + fires the stop toast). */
  readonly onStop: () => void
  /** Optional punch-clock (Ausstempeln): when provided, a Clock in/out button renders
   *  on the hero bar (issue #364 — the Planner Day view keeps the clock-in/out the old
   *  `PlannerDayTracker` had). Omit on surfaces without a work-day shift (e.g. Today). */
  readonly punchedIn?: boolean
  readonly punchBusy?: boolean
  readonly onClockIn?: () => void
  readonly onClockOut?: () => void
}

export function HeroTrackerBar({
  task,
  setTask,
  runningProject,
  billable,
  busy,
  running,
  accumulatedMs,
  elapsed,
  paused,
  pausedSinceMs,
  active,
  isRunning,
  setBillable,
  onPause,
  onResume,
  onStart,
  onStop,
  punchedIn,
  punchBusy,
  onClockIn,
  onClockOut,
}: HeroTrackerBarProps): React.JSX.Element {
  const t = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: t.spacing.s4,
        paddingVertical: t.spacing.s4,
        paddingHorizontal: t.spacing.s5,
        backgroundColor: t.color.surface,
        borderWidth: 1,
        borderColor: active ? (isRunning ? t.color.live : t.color.warn) : t.color.border,
        borderRadius: t.radius.xl,
      }}
    >
      <TextInput
        value={task}
        onChangeText={setTask}
        placeholder="What are you working on?"
        placeholderTextColor={t.color.ink3}
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 200,
          minWidth: 40,
          fontFamily: t.fontFamily.ui,
          fontSize: t.fontSize.lg,
          fontWeight: '500',
          color: t.color.ink,
        }}
      />
      {runningProject && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.s2,
            paddingVertical: 7,
            paddingHorizontal: 14,
            borderRadius: t.radius.pill,
            backgroundColor: t.color.sunk,
            borderWidth: 1,
            borderColor: t.color.border,
          }}
        >
          <View
            style={{
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: projectColor(runningProject.id, t.mode),
            }}
          />
          <Text style={{ fontSize: t.fontSize.xs, fontWeight: '600', color: t.color.ink2 }}>
            {runningProject.name}
          </Text>
        </View>
      )}
      {/* B5: billable € toggle — flips the running entry's billable flag live
          (server-authoritative money, ADR-0005) or the next-start default. */}
      <Pressable
        onPress={() => setBillable(!billable)}
        disabled={busy}
        // `button`, not `switch`: react-native-web doesn't emit aria-checked from
        // accessibilityState, so a switch role fails axe (REQ-043); the on/off state
        // rides the accessible name instead.
        accessibilityRole="button"
        accessibilityState={{ checked: billable }}
        accessibilityLabel={`Billable, ${billable ? 'on' : 'off'}`}
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: billable ? t.color.accent : t.color.borderStrong,
          backgroundColor: billable ? t.color.accentSoft : t.color.surface,
        }}
      >
        <Text
          style={{
            fontFamily: t.fontFamily.display,
            fontWeight: '700',
            fontSize: 15,
            color: billable ? t.color.accent : t.color.ink3,
          }}
        >
          €
        </Text>
      </Pressable>
      {/* Worked time is live-orange while a segment runs and frozen ink-3 while paused
          or idle; the pause counter stacks under it in warn, so the paused total holds
          and the pause visibly climbs instead (design v10). */}
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {isRunning && running ? (
          <ReanimatedTimer
            startedAt={running.startedAt}
            accumulatedMs={accumulatedMs}
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize.xl,
              fontWeight: '600',
              color: t.color.live,
              textAlign: 'right',
            }}
          />
        ) : (
          <Text
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize.xl,
              fontWeight: '600',
              color: t.color.ink3,
              textAlign: 'right',
            }}
          >
            {elapsed}
          </Text>
        )}
        {paused && (
          <PauseCounter
            pausedSinceMs={pausedSinceMs}
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize.xs,
              fontWeight: '600',
              color: t.color.warn,
              textAlign: 'right',
            }}
          />
        )}
      </View>
      <Pressable
        onPress={() => (paused ? onResume() : onPause())}
        disabled={!active || busy}
        accessibilityRole="button"
        accessibilityLabel={paused ? 'Resume' : 'Pause'}
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          borderWidth: 1.5,
          borderColor: !active ? t.color.border : paused ? t.color.warn : t.color.borderStrong,
          backgroundColor: !active ? 'transparent' : paused ? t.color.warnSoft : t.color.surface,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 4,
          opacity: !active ? 0.3 : 1,
        }}
      >
        {paused ? (
          <View
            style={{
              marginLeft: 3,
              width: 0,
              height: 0,
              borderTopWidth: 8,
              borderBottomWidth: 8,
              borderLeftWidth: 13,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              borderLeftColor: t.color.warn,
            }}
          />
        ) : (
          <>
            <View
              style={{ width: 5, height: 16, borderRadius: 2, backgroundColor: t.color.ink2 }}
            />
            <View
              style={{ width: 5, height: 16, borderRadius: 2, backgroundColor: t.color.ink2 }}
            />
          </>
        )}
      </Pressable>
      {/* The primary punch button breathes + emits pulse waves while active
          (design v4 motion pass); LiveButton is a no-op when idle or reduced-motion. */}
      <LiveButton active={active} color={active ? t.color.live : t.color.accent} size={64}>
        <Pressable
          onPress={() => (active ? onStop() : onStart())}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={active ? 'Stop' : 'Start'}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: active ? t.color.live : t.color.accent,
            alignItems: 'center',
            justifyContent: 'center',
            // Coloured glow under the punch button, matching the design
            // (box-shadow 0 10px 28px -8px, tinted live/accent).
            shadowColor: active ? t.color.live : t.color.accent,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.5,
            shadowRadius: 14,
            elevation: 8,
          }}
        >
          {active ? (
            <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: '#fff' }} />
          ) : (
            <View
              style={{
                marginLeft: 5,
                width: 0,
                height: 0,
                borderTopWidth: 13,
                borderBottomWidth: 13,
                borderLeftWidth: 22,
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
                borderLeftColor: '#fff',
              }}
            />
          )}
        </Pressable>
      </LiveButton>
      {/* Clock in/out (Ausstempeln) — optional punch clock on the hero bar (issue #364).
                Renders only when the host provides the work-day shift; Today omits it. */}
      {onClockIn !== undefined && onClockOut !== undefined && (
        <Button
          size="sm"
          variant={punchedIn ? 'ghost' : 'primary'}
          disabled={punchBusy ?? false}
          onPress={punchedIn ? onClockOut : onClockIn}
        >
          {punchedIn ? 'Clock out' : 'Clock in'}
        </Button>
      )}
    </View>
  )
}
