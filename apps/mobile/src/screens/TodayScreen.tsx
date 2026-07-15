import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native'
import { formatDuration, projectColor } from '@mydevtime/design'
import { Text } from '../components/core/Text'
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
  ReanimatedTimer,
  type OverflowItem,
} from '../components/index'
import { useTimerContext } from '../timer/TimerContext'
import { usePlanner } from '../hooks/usePlanner'
import { NlQuickAdd } from './NlQuickAdd'
import { useCatalog } from './useCatalog'
import { findProject } from './projectsData'

/** Minutes-from-midnight → `HH:MM`. */
function hhmm(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)}`
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
  const timer = useTimerContext()
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
        accessibilityRole="switch"
        accessibilityState={{ checked: timer.billable }}
        accessibilityLabel="Billable"
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
            color: paused ? t.color.warn : t.color.ink3,
            textAlign: 'right',
          }}
        >
          {timer.elapsed}
        </Text>
      )}
      {active && (
        <Pressable
          onPress={() => (paused ? timer.resume() : timer.pause())}
          disabled={timer.busy}
          accessibilityRole="button"
          accessibilityLabel={paused ? 'Resume' : 'Pause'}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            borderWidth: 1.5,
            borderColor: paused ? t.color.warn : t.color.borderStrong,
            backgroundColor: paused ? t.color.warnSoft : t.color.surface,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 4,
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
      )}
      {/* The primary punch button breathes + emits pulse waves while active
          (design v4 motion pass); LiveButton is a no-op when idle or reduced-motion. */}
      <LiveButton active={active} color={active ? t.color.live : t.color.accent} size={64}>
        <Pressable
          onPress={() => {
            if (active) {
              timer.punchOut()
              setAskMood(true)
            } else {
              const note = task.trim()
              timer.punchIn(note ? { note } : undefined)
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

  const autoTracker = (
    <Card title="Auto-Tracker" subtitle="App usage while tracking">
      <EmptyState
        title="Coming soon"
        hint="The Auto-Tracker breakdown appears here once it's enabled in Settings — local, exclusible, only while tracking."
        compact
      />
    </Card>
  )

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
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: t.spacing.s3,
          }}
        >
          <Text
            style={{
              fontWeight: '700',
              fontSize: t.fontSize.xl,
              color: t.color.ink,
              fontFamily: t.fontFamily.display,
              letterSpacing: t.fontSize.xl * t.letterSpacing.tight,
            }}
          >
            Today
          </Text>
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>{todayLabel()}</Text>
        </View>

        {heroBar}

        {askMood && <MoodCheck onDone={() => setAskMood(false)} />}

        <NlQuickAdd />

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
      </ScrollView>
    </View>
  )
}
