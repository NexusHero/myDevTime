import { useState, useEffect } from 'react'
import { Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native'
import { formatDuration, projectColor } from '@mydevtime/design'
import type { LoadLevel, TimesheetDraft } from '@mydevtime/domain'
import { apiBaseUrl } from '../config'
import { createEntry } from '../api/timer'
import { Text } from '../components/core/Text'
import { useToast } from '../components/core/Toast'
import { useTheme } from '../theme/ThemeProvider'
import {
  AICallout,
  Badge,
  Button,
  Card,
  DayBlock,
  EmptyState,
  Icon,
  LiveButton,
  MoodCheck,
  OverflowShelf,
  PauseCounter,
  ReanimatedTimer,
  type OverflowItem,
} from '../components/index'
import { useTimerContext } from '../timer/TimerContext'
import { usePlanner } from '../hooks/usePlanner'
import { usePreferences } from '../hooks/usePreferences'
import { useInsights } from '../hooks/useInsights'
import { useTrackReminder } from '../hooks/useTrackReminder'
import { useForgottenTimer } from '../hooks/useForgottenTimer'
import { usePomodoro } from '../focus/PomodoroContext'
import { useAutoTracker } from '../autotracker/useAutoTracker'
import { loadDaySpans, localDayKey } from '../autotracker/dayActivityStore'
import { useTodayEntries } from '../hooks/useTodayEntries'
import { todayShutdown } from '../today/shutdown'
import { SmartAdd } from './SmartAdd'
import { TravelEntry } from './TravelEntry'
import { useCatalog } from './useCatalog'
import { findProject } from './projectsData'

/** Minutes-from-midnight → `HH:MM`. */
function hhmm(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)}`
}

/** An ISO instant as local `HH:MM` (for the forgotten-timer "since …" label). */
function clockTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

/** A millisecond instant as local `HH:MM` (the KI6 draft window labels). */
function clockFromMs(ms: number): string {
  const d = new Date(ms)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Milliseconds as `MM:SS` (the Pomodoro phase countdown). */
function mmss(ms: number): string {
  const total = ms > 0 ? Math.floor(ms / 1000) : 0
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(Math.floor(total / 60))}:${p(total % 60)}`
}

/**
 * Today — the Day Canvas home (ux-vision §2.1, §3), ported 1:1 from the design
 * system's `TodayScreen`: the live hero tracker bar, a momentary mood check, the
 * real natural-language quick-add, the Co-Planner morning briefing (proposals as
 * dashed ghost blocks with visible reasoning — the AI signature), and the
 * Auto-Tracker. `--live` (orange) marks anything happening *now* and stays orange
 * under every accent (design rule); project colors are assigned deterministically
 * per id (ADR-0005). The AI never mutates state — every proposal lands only on your
 * tap. Numbers are real (the timer, the persisted plan) — no fabricated figures.
 */
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Today's date as `Weekday, Month D`. */
function todayLabel(): string {
  const d = new Date()
  return `${WEEKDAYS[d.getDay()] ?? ''}, ${MONTHS[d.getMonth()] ?? ''} ${String(d.getDate())}`
}

export function TodayScreen(): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const stacked = width < 720
  const [task, setTask] = useState('')
  const [dismissed, setDismissed] = useState<readonly number[]>([])
  // Punch-out mood is asked once, in the moment of stamping out — never a standing
  // widget (design v4 / OLBI rationale). Set on punch-out, cleared by the row itself.
  const [askMood, setAskMood] = useState(false)
  // Drift → re-plan (design v20 §Today AI moment): dismissed once per session so the nudge to
  // re-plan a slipping day never nags.
  const [replanDismissed, setReplanDismissed] = useState(false)
  const timer = useTimerContext()
  const toast = useToast()
  // Design v20 confirmations: starting and stopping the hero tracker lands a
  // transient toast. The wrappers only add feedback — the punch behaviour (and the
  // mood prompt on stop) is unchanged. English copy (UI is English-only).
  const startTracking = (input?: Parameters<typeof timer.punchIn>[0]): void => {
    timer.punchIn(input)
    toast.show('Timer running.')
  }
  const stopTracking = (): void => {
    const tracked = timer.elapsed // snapshot before the optimistic clear
    timer.punchOut()
    toast.show(`Timer stopped — ${tracked} tracked.`)
  }
  // The running entry's real project (resolved from the live catalog by its id) —
  // the hero chip binds to it and renders nothing when there is no running project.
  const catalog = useCatalog()
  const runningProject =
    timer.running?.projectId != null
      ? (findProject(catalog.data ?? [], timer.running.projectId)?.project ?? null)
      : null
  // The Co-Planner on Today is the real persisted plan (M5): its blocks, accept and
  // replan all go through the planner service — no local ghost constants.
  const planner = usePlanner()
  const plan = planner.plan
  const isRunning = timer.running !== null
  const paused = timer.paused
  // The session is "active" (has time on it) whether the segment is running or paused.
  const active = isRunning || paused

  // Auto-Tracker (REQ-042): captures the app's own tab activity while tracking, but
  // only after explicit consent (the persisted `autoTracker` preference) and only on
  // web, where first-party capture is real. Anything else → an honest empty state.
  const { prefs } = usePreferences()
  const captureAvailable = Platform.OS === 'web'
  const consented = prefs.autoTracker
  const activity = useAutoTracker(consented && captureAvailable, active)

  // Balance & Streak (REQ-032): real, deterministic signals from tracked time — the
  // focus streak and a neutral workload level. Both render as header chips only when
  // there is something honest to show; nothing is fabricated.
  const insights = useInsights().data

  // Smart Reminder (REQ-033/§D12): a deterministic nudge when clocked in but not
  // tracking — start a timer, or add it below. Never AI (no gradient), always dismissible.
  const reminder = useTrackReminder()

  // Forgotten-tracking (REQ-033): a dismissible, evidence-based proposal when the running
  // timer has been going implausibly long (from its own runtime — never surveillance).
  const forgotten = useForgottenTimer(
    timer.running ? Date.parse(timer.running.startedAt) : null,
    timer.running?.id ?? null,
  )

  // Focus mode / Pomodoro (REQ-032): focus intervals run as ordinary timer segments,
  // breaks pause them; this reads the shared session and drives it from the control below.
  const pomodoro = usePomodoro()
  const pomodoroPhaseLabel =
    pomodoro.phase === 'focus' ? 'Focus' : pomodoro.phase === 'longBreak' ? 'Long break' : 'Break'

  // Neutral, judgement-free colours for the workload chip: a calm week reads as good,
  // an ordinary one as quiet ink, a heavy one as a gentle warning — never alarm.
  const loadChip = (level: LoadLevel): { bg: string; fg: string } => {
    if (level === 'calm') return { bg: t.color.goodSoft, fg: t.color.good }
    if (level === 'elevated') return { bg: t.color.warnSoft, fg: t.color.warn }
    return { bg: t.color.overlay, fg: t.color.ink2 }
  }

  // Plan-adherence chip (design v20 §Today): today's tracked focus as a share of the planned
  // focus, taken verbatim from the deterministic `PlanReview` (ADR-0005) — no LLM, no estimate.
  // Null (chip hidden) until there is a plan with planned focus minutes to measure against.
  const planAdherence = ((): { label: string; bg: string; fg: string } | null => {
    const review = planner.review
    if (review === null || review.plannedFocusMin <= 0) return null
    const pct = Math.round((review.trackedFocusMin / review.plannedFocusMin) * 100)
    const tone =
      pct >= 90
        ? { bg: t.color.goodSoft, fg: t.color.good }
        : pct < 60
          ? { bg: t.color.warnSoft, fg: t.color.warn }
          : { bg: t.color.overlay, fg: t.color.ink2 }
    return { label: `Plan ${String(pct)}%`, ...tone }
  })()

  // Drift → re-plan (design v20 §Today, the first grounded AI moment): when today's tracked focus
  // has fallen materially behind the plan, offer to re-plan the rest of the day. The drift comes
  // straight from the deterministic `PlanReview` (ADR-0005), and "Re-plan" runs the real Co-Planner
  // generator (`planner.repropose`) — the app proposes, never books. Needs a live plan to re-plan.
  const driftReplan =
    planner.live && !replanDismissed && planner.review !== null && planner.review.driftMin <= -30
      ? planner.review
      : null

  const planBlocks = (plan?.blocks ?? []).map((b, i) => ({ ...b, index: i }))
  const visibleBlocks = planBlocks.filter(b => !dismissed.includes(b.index))
  const accepted = plan?.status === 'accepted'
  const dismissBlock = (index: number): void =>
    setDismissed(d => (d.includes(index) ? d : [...d, index]))

  // Overbooked/unplaced work becomes the "no slot" chip shelf (bounded screens,
  // ADR-0035): dropped meetings (M4) plus a backlog summary chip when time spilled.
  const overflowItems: readonly OverflowItem[] = plan
    ? [
        ...plan.droppedAnchors.map(a => ({
          label: a.label,
          detail: `${formatDuration(a.lenMin * 60_000)} h`,
        })),
        ...(plan.unplacedMin > 0
          ? [{ label: 'Backlog', detail: `${formatDuration(plan.unplacedMin * 60_000)} h` }]
          : []),
      ]
    : []

  const heroBar = (
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
        onPress={() => timer.setBillable(!timer.billable)}
        disabled={timer.busy}
        // `button`, not `switch`: react-native-web doesn't emit aria-checked from
        // accessibilityState, so a switch role fails axe (REQ-043); the on/off state
        // rides the accessible name instead.
        accessibilityRole="button"
        accessibilityState={{ checked: timer.billable }}
        accessibilityLabel={`Billable, ${timer.billable ? 'on' : 'off'}`}
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: timer.billable ? t.color.accent : t.color.borderStrong,
          backgroundColor: timer.billable ? t.color.accentSoft : t.color.surface,
        }}
      >
        <Text
          style={{
            fontFamily: t.fontFamily.display,
            fontWeight: '700',
            fontSize: 15,
            color: timer.billable ? t.color.accent : t.color.ink3,
          }}
        >
          €
        </Text>
      </Pressable>
      {/* Worked time is live-orange while a segment runs and frozen ink-3 while paused
          or idle; the pause counter stacks under it in warn, so the paused total holds
          and the pause visibly climbs instead (design v10). */}
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {isRunning && timer.running ? (
          <ReanimatedTimer
            startedAt={timer.running.startedAt}
            accumulatedMs={timer.accumulatedMs}
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
            {timer.elapsed}
          </Text>
        )}
        {paused && (
          <PauseCounter
            pausedSinceMs={timer.pausedSinceMs}
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
        onPress={() => (paused ? timer.resume() : timer.pause())}
        disabled={!active || timer.busy}
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
          onPress={() => {
            if (active) {
              stopTracking()
              setAskMood(true)
            } else {
              const note = task.trim()
              startTracking(note ? { note } : undefined)
              setTask('')
              setAskMood(false)
            }
          }}
          disabled={timer.busy}
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
    </View>
  )

  const coPlanner = (
    <Card
      title="Co-Planner"
      subtitle="Your plan for today"
      action={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          {visibleBlocks.length > 0 && (
            <Badge tone={accepted ? 'good' : 'accent'}>
              {accepted ? '✓ Accepted' : '✦ Proposal'}
            </Badge>
          )}
          {!accepted && visibleBlocks.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              disabled={planner.busy}
              onPress={() => planner.accept()}
            >
              Accept all
            </Button>
          )}
        </View>
      }
    >
      <View style={{ marginBottom: t.spacing.s3 }}>
        <AICallout
          title={
            plan === null
              ? 'No plan yet.'
              : `Your day: ${String(plan.blocks.filter(b => b.kind === 'meeting').length)} meetings, ${formatDuration(plan.plannedFocusMin * 60_000)} h focus.`
          }
        >
          {plan !== null && plan.unplacedMin > 0
            ? `${formatDuration(plan.unplacedMin * 60_000)} h backlog with no slot — prioritize or reschedule. Proposal below: accept, drag, or dismiss.`
            : 'Blocks below: accept, drag, or dismiss. The order follows priority.'}
        </AICallout>
      </View>
      {overflowItems.length > 0 && (
        <View style={{ marginBottom: t.spacing.s3 }}>
          <OverflowShelf items={overflowItems} />
        </View>
      )}
      {planner.loading && plan === null ? (
        <Text style={{ color: t.color.ink2 }}>Planning your day…</Text>
      ) : (
        <View style={{ gap: t.spacing.s2, opacity: planner.busy ? 0.5 : 1 }}>
          {visibleBlocks.map(b => (
            <DayBlock
              key={b.index}
              label={b.label}
              time={`${hhmm(b.startMin)}–${hhmm(b.startMin + b.lenMin)}`}
              kind={b.kind === 'meeting' ? 'meeting' : accepted ? 'actual' : 'ghost'}
              color={projectColor(b.taskId ?? b.label, t.mode)}
              {...(b.kind === 'meeting'
                ? {}
                : { onAccept: () => planner.accept(), onDismiss: () => dismissBlock(b.index) })}
            />
          ))}
        </View>
      )}
      {accepted && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.s2,
            marginTop: t.spacing.s3,
          }}
        >
          <Icon name="check" size={14} color={t.color.good} />
          <Text style={{ fontSize: t.fontSize['2xs'], fontWeight: '600', color: t.color.good }}>
            Plan accepted — {visibleBlocks.length} blocks are now fixed.
          </Text>
        </View>
      )}
    </Card>
  )

  const autoTrackerHint = !consented
    ? "Auto-Tracker is off. Turn it on in Settings to see where this session's time goes — local to your device, only while tracking."
    : !captureAvailable
      ? "App-usage capture isn't available on this platform yet — it runs in the web app today; local to your device."
      : !active
        ? 'Starts capturing when you start tracking — the split stays on this device.'
        : 'Watching this session — your activity split appears here.'

  const autoTracker = (
    <Card title="Auto-Tracker" subtitle="App usage while tracking">
      {activity && activity.segments.length > 0 ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              height: 10,
              borderRadius: t.radius.pill,
              overflow: 'hidden',
              gap: 2,
              marginBottom: t.spacing.s3,
            }}
          >
            {activity.segments.map(s => (
              <View
                key={s.source}
                style={{
                  flexGrow: Math.max(s.pct, 1),
                  flexBasis: 0,
                  backgroundColor: projectColor(s.source, t.mode),
                }}
              />
            ))}
          </View>
          <View style={{ gap: t.spacing.s2 }}>
            {activity.segments.map(s => (
              <View
                key={s.source}
                style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}
              >
                <View
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: projectColor(s.source, t.mode),
                  }}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: t.fontSize.xs,
                    fontWeight: '600',
                    color: t.color.ink,
                  }}
                >
                  {s.source}
                </Text>
                <Text
                  style={{
                    fontFamily: t.fontFamily.numeric,
                    fontSize: t.fontSize['2xs'],
                    color: t.color.ink2,
                  }}
                >
                  {formatDuration(s.ms)} h
                </Text>
                <Text
                  style={{
                    fontFamily: t.fontFamily.numeric,
                    fontSize: t.fontSize['2xs'],
                    color: t.color.ink3,
                    width: 40,
                    textAlign: 'right',
                  }}
                >
                  {s.pct}%
                </Text>
              </View>
            ))}
          </View>
          {/* Local-only guarantee, stated where the data actually appears (ADR-0057). */}
          <Text
            style={{
              marginTop: t.spacing.s3,
              fontSize: t.fontSize['2xs'],
              color: t.color.ink3,
            }}
          >
            Stays on this device — never uploaded.
          </Text>
        </>
      ) : (
        <EmptyState title="App usage while tracking" hint={autoTrackerHint} compact />
      )}
    </Card>
  )

  // Feierabend / shutdown ritual (REQ-063, design v17 §K5): the honest day-close. It reads only
  // real state — today's booked entries (`useTodayEntries`, empty without an API) and the local
  // Auto-Tracker reality history — and the deterministic `shutdownSummary` core owns every figure
  // (ADR-0005). On a day with nothing tracked or booked there is nothing to close (`idle`), so the
  // card stays hidden; it appears only once real work exists. The `git commit` line is the ritual
  // gesture; closing it is local to this session (no fabricated state).
  const [dayClosed, setDayClosed] = useState(false)
  const todayEntries = useTodayEntries()
  const reload = todayEntries.reload

  useEffect(() => {
    if (timer.lastSync > 0) {
      reload()
    }
  }, [timer.lastSync, reload])

  const todaySpans = loadDaySpans(localDayKey(Date.now()))
  const shutdown = todayShutdown({
    spans: todaySpans,
    booked: todayEntries.booked,
    bookedMs: todayEntries.bookedMs,
    tomorrowFirst: null,
  })

  // KI6 "your day, already written" (REQ-062, design v17 §K/KI6): the Auto-Tracker's unbooked
  // reality stretches become a review queue of **bookable drafts**. Accepting one books the
  // tracked time as a real manual entry over its window (deterministic — ADR-0005); the project
  // and an AI-phrased title are a later step, never auto-applied. The queue only shows when a
  // real API is configured (booking must actually persist) and the tracker has captured drafts.
  const [booking, setBooking] = useState(false)
  const bookDraft = async (d: TimesheetDraft): Promise<void> => {
    if (apiBaseUrl === null) return
    setBooking(true)
    try {
      await createEntry(apiBaseUrl, {
        startedAt: new Date(d.startMs).toISOString(),
        endedAt: new Date(d.endMs).toISOString(),
        note: d.source,
      })
      todayEntries.reload()
    } finally {
      setBooking(false)
    }
  }
  const bookAllDrafts = async (): Promise<void> => {
    if (apiBaseUrl === null) return
    setBooking(true)
    try {
      for (const d of shutdown.drafts) {
        await createEntry(apiBaseUrl, {
          startedAt: new Date(d.startMs).toISOString(),
          endedAt: new Date(d.endMs).toISOString(),
          note: d.source,
        })
      }
      todayEntries.reload()
    } finally {
      setBooking(false)
    }
  }
  const reviewCard =
    !todayEntries.live || shutdown.drafts.length === 0 ? null : (
      <Card title="Review your tracked day" subtitle="Drafts from the Auto-Tracker — you book them">
        <View style={{ gap: t.spacing.s3 }}>
          {shutdown.drafts.map(d => (
            <View
              key={`${String(d.startMs)}-${String(d.endMs)}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: t.spacing.s3,
              }}
            >
              <View style={{ flex: 1, minWidth: 160 }}>
                <Text style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: t.color.ink }}>
                  {d.source}
                </Text>
                <Text
                  style={{
                    fontFamily: t.fontFamily.numeric,
                    fontSize: t.fontSize.xs,
                    color: t.color.ink2,
                    marginTop: 2,
                  }}
                >
                  {`${clockFromMs(d.startMs)}–${clockFromMs(d.endMs)} · ${formatDuration(d.durationMs)} h`}
                </Text>
              </View>
              <Button size="sm" disabled={booking} onPress={() => void bookDraft(d)}>
                Book
              </Button>
            </View>
          ))}
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: t.spacing.s3,
            marginTop: t.spacing.s4,
          }}
        >
          <Text
            style={{ flex: 1, fontSize: t.fontSize['2xs'], color: t.color.ink3, minWidth: 160 }}
          >
            {`${formatDuration(shutdown.recoveredMs)} h of tracked time to recover. Booked as-is — assign a project (and let AI title them) after.`}
          </Text>
          {shutdown.drafts.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              disabled={booking}
              onPress={() => void bookAllDrafts()}
            >
              {`Book all · ${String(shutdown.drafts.length)}`}
            </Button>
          )}
        </View>
      </Card>
    )
  const shutdownCard =
    dayClosed || shutdown.state === 'idle' ? null : (
      <Card title="Close the day" subtitle="Feierabend">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s5 }}>
          <View>
            <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>Booked</Text>
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize.lg,
                fontWeight: '600',
                color: t.color.ink,
              }}
            >
              {`${formatDuration(shutdown.summary.bookedMs)} h`}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
              Tracked reality
            </Text>
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize.lg,
                fontWeight: '600',
                color: t.color.ink,
              }}
            >
              {`${formatDuration(shutdown.summary.trackedMs)} h`}
            </Text>
          </View>
          {shutdown.summary.unbookedMs > 0 && (
            <View>
              <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>Still open</Text>
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize.lg,
                  fontWeight: '600',
                  color: t.color.live,
                }}
              >
                {`${formatDuration(shutdown.summary.unbookedMs)} h`}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={{
            fontSize: t.fontSize.xs,
            color: t.color.ink2,
            lineHeight: 18,
            marginTop: t.spacing.s3,
          }}
        >
          {shutdown.state === 'clean'
            ? 'Everything you tracked is booked — the day is fully accounted for. Feierabend.'
            : shutdown.summary.openDraftCount > 0
              ? `${String(shutdown.summary.openDraftCount)} draft${shutdown.summary.openDraftCount === 1 ? '' : 's'} to book (${formatDuration(shutdown.recoveredMs)} h of tracked reality). Open the Planner to review and book them — nothing is booked for you.`
              : 'Some tracked reality is still unbooked. Open the Planner to book it before you close the day.'}
        </Text>
        {shutdown.summary.tomorrowFirst !== null && (
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3, marginTop: t.spacing.s2 }}>
            {`Tomorrow starts with ${shutdown.summary.tomorrowFirst}.`}
          </Text>
        )}
        <View style={{ flexDirection: 'row', marginTop: t.spacing.s4 }}>
          <Button size="sm" onPress={() => setDayClosed(true)}>
            {'git commit -m "Feierabend"'}
          </Button>
        </View>
      </Card>
    )

  // Forgotten-tracking proposal card (REQ-033): evidence is the running timer's own
  // runtime; the user confirms Stop / Trim / Keep — nothing auto-corrects. Bound to
  // locals so the trim handler narrows the (non-null) proposal + run cleanly.
  let forgottenCard: React.JSX.Element | null = null
  if (forgotten.proposal !== null && timer.running !== null) {
    const fp = forgotten.proposal
    const startIso = timer.running.startedAt
    forgottenCard = (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: t.spacing.s3,
          padding: t.spacing.s4,
          borderRadius: t.radius.card,
          borderWidth: 1,
          borderColor: t.color.warn,
          backgroundColor: t.color.warnSoft,
        }}
      >
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink }}>
            {`Still running after ${formatDuration(fp.elapsedMs)} h`}
          </Text>
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 2 }}>
            {`Tracking since ${clockTime(startIso)} — forgot to stop it? Nothing changes until you choose.`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
          <Button size="sm" disabled={timer.busy} onPress={() => timer.punchOut()}>
            Stop now
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={timer.busy}
            onPress={() => {
              timer.punchOut(new Date(fp.suggestedEndMs).toISOString())
            }}
          >
            {`Trim to ${formatDuration(fp.suggestedEndMs - Date.parse(startIso))} h`}
          </Button>
          <Button size="sm" variant="ghost" onPress={forgotten.dismiss}>
            Keep
          </Button>
        </View>
      </View>
    )
  }

  // Focus mode control (REQ-032): start a Pomodoro (25/5) or, while one runs, show the
  // phase + countdown with skip/stop. Each focus interval is an ordinary timer segment.
  const pomodoroActive = pomodoro.active
  const pomodoroIsBreak = pomodoro.phase === 'break' || pomodoro.phase === 'longBreak'
  const pomodoroTone = pomodoroIsBreak ? t.color.good : t.color.accent
  const pomodoroCard = pomodoroActive ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: t.spacing.s3,
        padding: t.spacing.s4,
        borderRadius: t.radius.card,
        borderWidth: 1,
        borderColor: pomodoroTone,
        backgroundColor: t.color.surface,
      }}
    >
      <View style={{ flex: 1, minWidth: 160 }}>
        <Text style={{ fontSize: t.fontSize['2xs'], fontWeight: '700', color: pomodoroTone }}>
          {`${pomodoroPhaseLabel.toUpperCase()} · ${String(pomodoro.completedFocus)} done`}
        </Text>
        <Text
          style={{
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize['2xl'],
            fontWeight: '600',
            color: t.color.ink,
          }}
        >
          {mmss(pomodoro.remainingMs)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
        <Button size="sm" variant="ghost" onPress={() => pomodoro.skip()}>
          {pomodoroIsBreak ? 'Skip break' : 'Skip'}
        </Button>
        <Button size="sm" variant="ghost" onPress={() => pomodoro.stop()}>
          End focus
        </Button>
      </View>
    </View>
  ) : !active ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: t.spacing.s3,
        padding: t.spacing.s4,
        borderRadius: t.radius.card,
        borderWidth: 1,
        borderColor: t.color.border,
        backgroundColor: t.color.surface,
      }}
    >
      <View style={{ flex: 1, minWidth: 160 }}>
        <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink }}>
          Focus mode
        </Text>
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 2 }}>
          25 min focus, 5 min break — each focus block is tracked like any timer.
        </Text>
      </View>
      <Button size="sm" onPress={() => pomodoro.start()}>
        Start focus
      </Button>
    </View>
  ) : null

  // Today carries the clock in its hero tracker, so the persistent Island is hidden
  // here and shown on every other screen from the AppShell (design v2 — never two
  // clocks). A little bottom clearance keeps the last card off the tab bar.
  const SCROLL_BOTTOM_CLEARANCE = 40

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: t.spacing.s5,
          paddingBottom: SCROLL_BOTTOM_CLEARANCE,
          gap: t.spacing.s4,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: t.spacing.s3,
          }}
        >
          <Text
            style={{
              fontWeight: '700',
              fontSize: t.fontSize['2xl'],
              color: t.color.ink,
              fontFamily: t.fontFamily.display,
              letterSpacing: t.fontSize['2xl'] * t.letterSpacing.tight,
            }}
          >
            Today
          </Text>
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>{todayLabel()}</Text>

          {insights && insights.streak > 0 && (
            <View
              style={{
                paddingHorizontal: t.spacing.s2,
                paddingVertical: 2,
                borderRadius: t.radius.chip,
                backgroundColor: t.color.liveSoft,
              }}
            >
              <Text style={{ fontSize: t.fontSize.xs, fontWeight: '600', color: t.color.live }}>
                {`Streak ${String(insights.streak)}`}
              </Text>
            </View>
          )}

          {insights && insights.load.ratio !== null && (
            <View
              style={{
                paddingHorizontal: t.spacing.s2,
                paddingVertical: 2,
                borderRadius: t.radius.chip,
                backgroundColor: loadChip(insights.load.level).bg,
              }}
            >
              <Text
                style={{
                  fontSize: t.fontSize.xs,
                  fontWeight: '600',
                  color: loadChip(insights.load.level).fg,
                }}
              >
                {`Balance: ${insights.load.level}`}
              </Text>
            </View>
          )}

          {/* Plan-adherence chip (design v20 §Today): tracked vs planned focus for today, straight
              from the deterministic evening review (`PlanReview`) — never an AI guess, never
              fabricated. Shown only once there is a plan with planned focus to compare against. */}
          {planAdherence !== null && (
            <View
              style={{
                paddingHorizontal: t.spacing.s2,
                paddingVertical: 2,
                borderRadius: t.radius.chip,
                backgroundColor: planAdherence.bg,
              }}
            >
              <Text style={{ fontSize: t.fontSize.xs, fontWeight: '600', color: planAdherence.fg }}>
                {planAdherence.label}
              </Text>
            </View>
          )}
        </View>

        {heroBar}

        {pomodoroCard}

        {reminder.show && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: t.spacing.s3,
              padding: t.spacing.s4,
              borderRadius: t.radius.card,
              borderWidth: 1,
              borderColor: t.color.warn,
              backgroundColor: t.color.warnSoft,
            }}
          >
            <View style={{ flex: 1, minWidth: 180 }}>
              <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink }}>
                Clocked in, but not tracking
              </Text>
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 2 }}>
                Start a timer so this time lands on a project — or add it below.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
              <Button size="sm" onPress={() => startTracking()}>
                Start timer
              </Button>
              <Button size="sm" variant="ghost" onPress={reminder.dismiss}>
                Dismiss
              </Button>
            </View>
          </View>
        )}

        {forgottenCard}

        {driftReplan !== null && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: t.spacing.s3,
              padding: t.spacing.s4,
              borderRadius: t.radius.card,
              borderWidth: 1,
              borderColor: t.color.accent,
              backgroundColor: t.color.accentSoft,
            }}
          >
            <View style={{ flex: 1, minWidth: 180 }}>
              <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink }}>
                {`✦ Behind plan by ${formatDuration(Math.abs(driftReplan.driftMin) * 60_000)} h`}
              </Text>
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 2 }}>
                Tracked focus is under today&apos;s plan. Re-plan the rest of the day — a proposal
                you decide on, nothing is booked for you.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
              <Button size="sm" disabled={planner.busy} onPress={() => planner.repropose()}>
                Re-plan day
              </Button>
              <Button size="sm" variant="ghost" onPress={() => setReplanDismissed(true)}>
                Dismiss
              </Button>
            </View>
          </View>
        )}

        {askMood && <MoodCheck onDone={() => setAskMood(false)} />}

        <SmartAdd />
        <TravelEntry />

        <View
          style={{
            flexDirection: stacked ? 'column' : 'row',
            gap: t.spacing.s4,
            alignItems: 'flex-start',
          }}
        >
          <View
            style={{ alignSelf: 'stretch', gap: t.spacing.s4, ...(stacked ? null : { flex: 1 }) }}
          >
            {coPlanner}
          </View>
          <View style={{ alignSelf: 'stretch', ...(stacked ? null : { flex: 1 }) }}>
            {autoTracker}
          </View>
        </View>

        {reviewCard}
        {shutdownCard}
      </ScrollView>
    </View>
  )
}
