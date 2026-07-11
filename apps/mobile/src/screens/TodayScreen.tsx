import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native'
import { projectColor, type Theme } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { useTheme } from '../theme/ThemeProvider'
import {
  AICallout,
  Badge,
  Button,
  Card,
  DayBlock,
  Icon,
  Island,
  MoodCheck,
} from '../components/index'
import { useTimer } from '../hooks/useTimer'
import { NlQuickAdd } from './NlQuickAdd'

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
interface Ghost {
  readonly id: string
  readonly label: string
  readonly time: string
  readonly project: string
}

const INITIAL_GHOSTS: readonly Ghost[] = [
  { id: 'g1', label: 'Deep work: Sync engine', time: '13:00–15:00', project: 'sync-engine' },
  { id: 'g2', label: 'Code review backlog', time: '15:15–16:00', project: 'reviews' },
]

const REPLAN_GHOSTS: readonly Ghost[] = [
  { id: 'g3', label: 'Deep work: Sync engine', time: '13:00–14:45', project: 'sync-engine' },
  { id: 'g4', label: 'Nordwind Call (verschoben)', time: '15:00–15:45', project: 'nordwind' },
  { id: 'g5', label: 'Code review backlog', time: '16:00–16:45', project: 'reviews' },
]

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
  const [ghosts, setGhosts] = useState<readonly Ghost[]>(INITIAL_GHOSTS)
  const [accepted, setAccepted] = useState<readonly string[]>([])
  const [planning, setPlanning] = useState(false)
  const [driftEvent, setDriftEvent] = useState(true)
  const [task, setTask] = useState('Sync engine: conflict resolution')
  const [idleHint, setIdleHint] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const timer = useTimer()
  const isRunning = timer.running !== null
  const paused = timer.paused
  // The session is "active" (has time on it) whether the segment is running or paused.
  const active = isRunning || paused
  const recording = isRunning

  const acceptGhost = (id: string): void => setAccepted(a => (a.includes(id) ? a : [...a, id]))
  const dismissGhost = (id: string): void => setGhosts(gs => gs.filter(g => g.id !== id))

  // One-tap replan: the Co-Planner reflows the rest of the day (deterministic
  // engine proposes; nothing lands without your tap — ADR-0005).
  const replan = (): void => {
    setPlanning(true)
    setTimeout(() => {
      setGhosts(REPLAN_GHOSTS)
      setAccepted([])
      setDriftEvent(false)
      setPlanning(false)
    }, 900)
  }

  const segColors = appSegmentColors(t)
  const allAccepted = accepted.length > 0 && accepted.length === ghosts.length

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
      <Text
        style={{
          fontFamily: t.fontFamily.numeric,
          fontSize: t.fontSize.xl,
          fontWeight: '600',
          color: isRunning ? t.color.live : paused ? t.color.warn : t.color.ink3,
          textAlign: 'right',
        }}
      >
        {timer.elapsed}
      </Text>
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
      subtitle="Morgen-Briefing · 08:12"
      action={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          <Badge tone="accent">✦ Vorschlag</Badge>
          {ghosts.some(g => !accepted.includes(g.id)) && (
            <Button size="sm" variant="ghost" onPress={() => setAccepted(ghosts.map(g => g.id))}>
              Alle übernehmen
            </Button>
          )}
        </View>
      }
    >
      <View style={{ marginBottom: t.spacing.s3 }}>
        <AICallout title="Dein Tag: 3 Meetings, 4,5h Fokus möglich.">
          Nordwind ist bei 91% Budget — Deep Work auf Sync engine priorisiert, Reviews in den
          Nachmittag. Vorschlag unten: annehmen, ziehen oder verwerfen.
        </AICallout>
      </View>
      <View style={{ gap: t.spacing.s2, opacity: planning ? 0.5 : 1 }}>
        <DayBlock
          label="Team standup"
          time="09:00–09:15"
          kind="meeting"
          color={projectColor('finanzo', t.mode)}
          height={48}
        />
        <DayBlock
          label="Finanzo Review"
          time="09:30–11:00"
          kind="actual"
          color={projectColor('finanzo', t.mode)}
          height={56}
        />
        <DayBlock
          label="Client call — Nordwind"
          time="11:15–12:00"
          kind="meeting"
          color={projectColor('nordwind', t.mode)}
          height={48}
        />
        {ghosts.map(g => (
          <DayBlock
            key={g.id}
            label={g.label}
            time={g.time}
            kind={accepted.includes(g.id) ? 'actual' : 'ghost'}
            color={projectColor(g.project, t.mode)}
            onAccept={() => acceptGhost(g.id)}
            onDismiss={() => dismissGhost(g.id)}
          />
        ))}
      </View>
      {planning && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.s2,
            marginTop: t.spacing.s3,
          }}
        >
          <Icon name="assistant" size={14} color={t.color.accentText} />
          <Text
            style={{ fontSize: t.fontSize['2xs'], fontWeight: '600', color: t.color.accentText }}
          >
            Co-Planner ordnet den Rest des Tages neu …
          </Text>
        </View>
      )}
      {!planning && allAccepted && (
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
            Plan übernommen — {ghosts.length} Blöcke sind jetzt fest.
          </Text>
        </View>
      )}
    </Card>
  )

  const autoTracker = (
    <Card
      title="Auto-Tracker"
      subtitle={recording ? 'zeichnet auf' : 'pausiert'}
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

  const floatingIsland = (
    <View
      style={{
        position: 'absolute',
        bottom: t.spacing.s5,
        alignSelf: 'center',
        pointerEvents: 'box-none',
      }}
    >
      <Island
        running={isRunning}
        elapsed={timer.elapsed}
        punched={active}
        expanded={expanded}
        onToggle={() => setExpanded(e => !e)}
        actions={
          active
            ? [
                paused
                  ? { label: timer.busy ? '…' : 'Weiter', onPress: timer.resume }
                  : { label: 'Pause', onPress: timer.pause },
                { label: timer.busy ? '…' : 'Stop', onPress: timer.punchOut },
              ]
            : [{ label: timer.busy ? '…' : 'Start', onPress: () => timer.punchIn() }]
        }
      />
    </View>
  )

  const SCROLL_BOTTOM_CLEARANCE = 120 // Space for the floating Island

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
      {floatingIsland}
    </View>
  )
}
