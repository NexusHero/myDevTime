import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native'
import { formatDuration, projectColor, type Theme } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { useTheme } from '../theme/ThemeProvider'
import {
  AICallout,
  Badge,
  Button,
  Card,
  DayBlock,
  Icon,
  LoadMeter,
  MoodCheck,
  OverflowShelf,
  ReanimatedTimer,
  type OverflowItem,
} from '../components/index'
import { useTimerContext } from '../timer/TimerContext'
import { usePlanner } from '../hooks/usePlanner'
import { NlQuickAdd } from './NlQuickAdd'

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
 * dashed ghost blocks with visible reasoning — the AI signature), a drift event
 * that reflows the day, and the Auto-Tracker. `--live` (orange) marks anything
 * happening *now* and stays orange under every accent (design rule); project
 * colors are assigned deterministically per id (ADR-0005). The AI never mutates
 * state — every proposal lands only on your tap.
 */
/** Auto-Tracker sample: share of the running session per app (deterministic demo). */
const APP_USAGE: readonly { readonly name: string; readonly mins: number; readonly pct: number }[] =
  [
    { name: 'VS Code', mins: 96, pct: 68 },
    { name: 'Chrome — localhost', mins: 21, pct: 15 },
    { name: 'Terminal', mins: 14, pct: 10 },
    { name: 'Figma', mins: 10, pct: 7 },
  ]

/** A status pill: a colored dot + label, in a soft wash of its tone. */
function StatusPill({
  dot,
  soft,
  fg,
  label,
}: {
  readonly dot: string
  readonly soft: string
  readonly fg: string
  readonly label: string
}): React.JSX.Element {
  const t = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: t.radius.pill,
        backgroundColor: soft,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
      <Text style={{ fontSize: t.fontSize['2xs'], fontWeight: '600', color: fg }}>{label}</Text>
    </View>
  )
}

function appSegmentColors(t: Theme): readonly string[] {
  return [
    projectColor('sync-engine', t.mode),
    projectColor('reviews', t.mode),
    projectColor('finanzo', t.mode),
    projectColor('nordwind', t.mode),
  ]
}

export function TodayScreen(): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const stacked = width < 720
  const [driftEvent, setDriftEvent] = useState(true)
  const [task, setTask] = useState('Sync engine: conflict resolution')
  const [idleHint, setIdleHint] = useState(true)
  const [dismissed, setDismissed] = useState<readonly number[]>([])
  const timer = useTimerContext()
  // The Co-Planner on Today is the real persisted plan (M5): its blocks, accept and
  // replan all go through the planner service — no local ghost constants.
  const planner = usePlanner()
  const plan = planner.plan
  const isRunning = timer.running !== null
  const paused = timer.paused
  // The session is "active" (has time on it) whether the segment is running or paused.
  const active = isRunning || paused
  const recording = isRunning

  const planBlocks = (plan?.blocks ?? []).map((b, i) => ({ ...b, index: i }))
  const visibleBlocks = planBlocks.filter(b => !dismissed.includes(b.index))
  const accepted = plan?.status === 'accepted'
  const dismissBlock = (index: number): void =>
    setDismissed(d => (d.includes(index) ? d : [...d, index]))

  // Overbooked/unplaced work becomes the "ohne Platz" chip shelf (bounded screens,
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

  // One-tap replan: the Co-Planner reflows the day (deterministic engine proposes;
  // the new version persists — ADR-0005). Clears local dismissals.
  const replan = (): void => {
    setDismissed([])
    planner.repropose()
    setDriftEvent(false)
  }

  const segColors = appSegmentColors(t)

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
        placeholder="Woran arbeitest du?"
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
            backgroundColor: projectColor('sync-engine', t.mode),
          }}
        />
        <Text style={{ fontSize: t.fontSize.xs, fontWeight: '600', color: t.color.ink2 }}>
          Sync engine
        </Text>
      </View>
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
          accessibilityLabel={paused ? 'Weiter' : 'Pause'}
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
      <Pressable
        onPress={() => (active ? timer.punchOut() : timer.punchIn())}
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
          // Coloured glow under the Stempel button, matching the design
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
    </View>
  )

  const coPlanner = (
    <Card
      title="Co-Planner"
      subtitle={planner.live ? 'Dein Plan für heute' : 'Morgen-Briefing · Beispiel'}
      action={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          <Badge tone={accepted ? 'good' : 'accent'}>
            {accepted ? '✓ Angenommen' : '✦ Vorschlag'}
          </Badge>
          {!planner.live && <Badge tone="neutral">Demo</Badge>}
          {!accepted && visibleBlocks.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              disabled={planner.busy}
              onPress={() => planner.accept()}
            >
              Alle übernehmen
            </Button>
          )}
        </View>
      }
    >
      <View style={{ marginBottom: t.spacing.s3 }}>
        <AICallout
          title={
            plan === null
              ? 'Noch kein Plan.'
              : `Dein Tag: ${String(plan.blocks.filter(b => b.kind === 'meeting').length)} Termine, ${formatDuration(plan.plannedFocusMin * 60_000)} h Fokus.`
          }
        >
          {plan !== null && plan.unplacedMin > 0
            ? `${formatDuration(plan.unplacedMin * 60_000)} h Backlog ohne Platz — priorisiere oder verschiebe. Vorschlag unten: annehmen, ziehen oder verwerfen.`
            : 'Blöcke unten: annehmen, ziehen oder verwerfen. Die Reihenfolge folgt der Priorität.'}
        </AICallout>
      </View>
      {overflowItems.length > 0 && (
        <View style={{ marginBottom: t.spacing.s3 }}>
          <OverflowShelf items={overflowItems} />
        </View>
      )}
      {planner.loading && plan === null ? (
        <Text style={{ color: t.color.ink2 }}>Dein Tag wird geplant …</Text>
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
            Plan übernommen — {visibleBlocks.length} Blöcke sind jetzt fest.
          </Text>
        </View>
      )}
    </Card>
  )

  const autoTracker = (
    <Card
      title="Auto-Tracker"
      subtitle="Beispiel-App-Nutzung"
      action={
        recording ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color.live }} />
            <Text
              style={{
                fontSize: t.fontSize['2xs'],
                fontWeight: '700',
                color: t.color.live,
                letterSpacing: t.fontSize['2xs'] * t.letterSpacing.wide,
              }}
            >
              REC
            </Text>
          </View>
        ) : undefined
      }
    >
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
        {APP_USAGE.map((a, i) => (
          <View key={a.name} style={{ width: `${a.pct}%`, backgroundColor: segColors[i] }} />
        ))}
      </View>
      <View style={{ gap: t.spacing.s2 }}>
        {APP_USAGE.map((a, i) => (
          <View
            key={a.name}
            style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                backgroundColor: t.color.ink,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: t.color.surface,
                  fontFamily: t.fontFamily.display,
                }}
              >
                {a.name[0]}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: t.fontSize.xs, fontWeight: '600', color: t.color.ink }}
              >
                {a.name}
              </Text>
              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: t.color.sunk,
                  marginTop: 4,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${a.pct}%`,
                    height: '100%',
                    borderRadius: 2,
                    backgroundColor: segColors[i],
                  }}
                />
              </View>
            </View>
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize['2xs'],
                color: t.color.ink2,
              }}
            >
              {Math.floor(a.mins / 60) > 0 ? `${Math.floor(a.mins / 60)}h ` : ''}
              {a.mins % 60}m
            </Text>
          </View>
        ))}
      </View>
      <View
        style={{
          marginTop: t.spacing.s3,
          paddingTop: t.spacing.s3,
          borderTopWidth: 1,
          borderTopColor: t.color.border,
        }}
      >
        <AICallout title="68% im Editor">
          Die Session sieht nach reiner Umsetzung aus. Als „Sync engine: Implementierung“ buchen?
        </AICallout>
      </View>
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
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>Tuesday, July 8</Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: t.spacing.s2,
              marginLeft: 'auto',
            }}
          >
            <StatusPill
              dot={t.color.good}
              soft={t.color.goodSoft}
              fg={t.color.good}
              label="Im Plan · +6m"
            />
            <StatusPill
              dot={t.color.warn}
              soft={t.color.warnSoft}
              fg={t.color.warn}
              label="Balance: erhöht"
            />
            <StatusPill
              dot={t.color.live}
              soft={t.color.liveSoft}
              fg={t.color.liveStrong}
              label="Serie 12"
            />
          </View>
        </View>

        {heroBar}

        <MoodCheck />

        <NlQuickAdd />

        {isRunning && idleHint && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.s3,
              paddingVertical: t.spacing.s3,
              paddingHorizontal: t.spacing.s4,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: t.color.borderStrong,
              borderRadius: t.radius.card,
              backgroundColor: t.color.surface,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color.warn }} />
            <Text style={{ flex: 1, fontSize: t.fontSize.xs, color: t.color.ink2 }}>
              <Text style={{ color: t.color.ink, fontWeight: '600' }}>14 min ohne Aktivität</Text>
              {' (12:04–12:18) — Timer um die Lücke kürzen?'}
            </Text>
            <Button size="sm" variant="secondary" onPress={() => setIdleHint(false)}>
              Kürzen
            </Button>
            <Button size="sm" variant="ghost" onPress={() => setIdleHint(false)}>
              Behalten
            </Button>
          </View>
        )}

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
            {driftEvent && (
              <AICallout
                title="Nordwind Call auf 15:00 verschoben."
                action={
                  <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
                    <Button size="sm" onPress={replan}>
                      ✦ Neu planen
                    </Button>
                    <Button size="sm" variant="ghost" onPress={() => setDriftEvent(false)}>
                      Ignorieren
                    </Button>
                  </View>
                }
              >
                Rest des Tages neu planen?
              </AICallout>
            )}
          </View>
          <View style={{ alignSelf: 'stretch', ...(stacked ? null : { flex: 1 }) }}>
            {autoTracker}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
