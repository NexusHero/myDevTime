import { useState } from 'react'
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import { formatDuration, plannerBlockRect, projectColor, type Theme } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { AICallout, AIAskBar, Badge, Button, Card, Icon } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { usePlanner } from '../hooks/usePlanner'
import type { PlanBlock } from '../api/planner'

/**
 * Planner — the week view of day canvases (ux-vision §2.1/§3, issue #11), ported
 * 1:1 from the design system's `PlannerScreen`: a header with the KW week
 * selector and week-total, an in-context AI ask bar (AI is reachable here, not
 * just in the Assistant tab), the week canvas where plan (dashed ghost blocks —
 * REQ-031) and actuals (solid, project-colored) share one surface per day so
 * drift is visible by *looking*, the red `--live` "Jetzt" now-line, the live
 * Co-Planner proposal (deterministic core's ghost blocks — ADR-0005), and the
 * legend. Block geometry comes from the pure, tested `plannerBlockRect`; project
 * colors are deterministic per id. The AI never mutates state — every proposal
 * lands only on your tap. Cross-day drag arrives with the interaction spec (#39).
 * TODO(design): drag-drop tracked in #117.
 */

// ---- Week-canvas geometry: 08:00–18:00, minutes from the top of the window ----
const START_HOUR = 8
const END_HOUR = 18
const SPAN = (END_HOUR - START_HOUR) * 60
const BODY_HEIGHT = 440
const HEADER_HEIGHT = 46
const GUTTER = 52
const COL_WIDTH = 150
const STACK_BREAKPOINT = 860
/** "Jetzt" — 14:20, in minutes from 08:00. */
const NOW_MIN = (14 - START_HOUR) * 60 + 20

type CanvasKind = 'actual' | 'meeting' | 'ghost' | 'break'

interface CanvasBlock {
  readonly day: number
  /** Minutes from 08:00. */
  readonly start: number
  /** Length in minutes. */
  readonly len: number
  readonly label: string
  readonly kind: CanvasKind
  /** Project id for a deterministic color; omit for breaks / absence. */
  readonly project?: string
}

interface DemoDay {
  readonly name: string
  readonly date: string
  readonly total: string
  readonly today?: boolean
}

const DEMO_DAYS: readonly DemoDay[] = [
  { name: 'Mo', date: '7.7.', total: '7,2h' },
  { name: 'Di', date: '8.7.', total: '5,4h', today: true },
  { name: 'Mi', date: '9.7.', total: '6,5h' },
  { name: 'Do', date: '10.7.', total: '7,0h' },
  { name: 'Fr', date: '11.7.', total: '—' },
]

/** day 0–4 · start/len in minutes from 08:00 · kind + project id for the color. */
const DEMO_BLOCKS: readonly CanvasBlock[] = [
  { day: 0, start: 60, len: 15, label: 'Standup', kind: 'meeting', project: 'finanzo' },
  { day: 0, start: 90, len: 150, label: 'Finanzo API', kind: 'actual', project: 'finanzo' },
  { day: 0, start: 270, len: 30, label: 'Pause', kind: 'break' },
  { day: 0, start: 300, len: 120, label: 'Sync engine', kind: 'actual', project: 'sync-engine' },
  { day: 0, start: 450, len: 90, label: 'Code review', kind: 'actual', project: 'reviews' },
  { day: 1, start: 60, len: 15, label: 'Standup', kind: 'meeting', project: 'finanzo' },
  { day: 1, start: 90, len: 90, label: 'Finanzo Review', kind: 'actual', project: 'finanzo' },
  { day: 1, start: 195, len: 45, label: 'Nordwind Call', kind: 'meeting', project: 'nordwind' },
  { day: 1, start: 240, len: 45, label: 'Pause', kind: 'break' },
  {
    day: 1,
    start: 300,
    len: 120,
    label: 'Deep work: Sync engine',
    kind: 'ghost',
    project: 'sync-engine',
  },
  { day: 1, start: 435, len: 45, label: 'Review backlog', kind: 'ghost', project: 'reviews' },
  { day: 2, start: 60, len: 120, label: 'Nordwind Sprint', kind: 'actual', project: 'nordwind' },
  { day: 2, start: 210, len: 60, label: 'Pairing', kind: 'meeting', project: 'sync-engine' },
  { day: 2, start: 270, len: 30, label: 'Pause', kind: 'break' },
  { day: 2, start: 330, len: 180, label: 'Deep work', kind: 'ghost', project: 'sync-engine' },
  { day: 3, start: 60, len: 15, label: 'Standup', kind: 'meeting', project: 'finanzo' },
  { day: 3, start: 120, len: 180, label: 'Finanzo API', kind: 'ghost', project: 'finanzo' },
  { day: 3, start: 270, len: 45, label: 'Pause', kind: 'break' },
  { day: 3, start: 360, len: 60, label: 'Client call', kind: 'meeting', project: 'nordwind' },
  { day: 3, start: 450, len: 120, label: 'Sync engine', kind: 'ghost', project: 'sync-engine' },
  { day: 4, start: 60, len: 480, label: 'Urlaub', kind: 'ghost' },
]

const DEMO_ASK: readonly { readonly q: string; readonly a: string }[] = [
  {
    q: 'Wo wird es diese Woche eng?',
    a: 'Donnerstag: 9,3h geplant bei 8:20h Soll — der Nordwind-Block (2h) drückt das Restbudget von 7,2h auf 5,2h. Vorschlag: den Review-Block auf Freitagvormittag ziehen.',
  },
  {
    q: 'Schaffe ich mein Wochen-Soll?',
    a: 'Knapp: 26,1h gebucht plus 14,5h geplant ergeben 40,6h bei 41:40h Soll. Es fehlt rund 1h — Freitag ist bis auf den Urlaub noch frei.',
  },
]

const ASK_FALLBACK =
  'Dazu habe ich gerade keine belastbare Antwort — frag mich nach Engpässen oder deinem Wochen-Soll.'

function canvasBlockColor(t: Theme, b: CanvasBlock): string {
  if (b.kind === 'break' || b.project === undefined) return t.color.ink3
  return projectColor(b.project, t.mode)
}

/** Clock label for a minute offset from 08:00. */
function clock(minFromStart: number): string {
  const m = START_HOUR * 60 + minFromStart
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(Math.floor(m / 60))}:${p(m % 60)}`
}

/** One absolutely-positioned block on a day column (canvas geometry, ADR-0005). */
function CanvasBlockView({ block }: { readonly block: CanvasBlock }): React.JSX.Element {
  const t = useTheme()
  const rect = plannerBlockRect(block.start, block.len, SPAN)
  const color = canvasBlockColor(t, block)
  const px = Math.max(rect.height * BODY_HEIGHT, 13)
  const isGhost = block.kind === 'ghost'
  const isMeeting = block.kind === 'meeting'
  const isBreak = block.kind === 'break'

  const labelColor = isMeeting ? '#ffffff' : isGhost ? color : isBreak ? t.color.ink3 : t.color.ink
  const timeColor = isMeeting ? 'rgba(255,255,255,0.85)' : isGhost ? color : t.color.ink2

  return (
    <View
      style={{
        position: 'absolute',
        left: 4,
        right: 4,
        top: rect.top * BODY_HEIGHT + 1,
        height: px,
        borderRadius: t.radius.chip,
        paddingHorizontal: 7,
        paddingVertical: px >= 26 ? 4 : 0,
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: isGhost ? 1.5 : isBreak ? 1 : 0,
        borderStyle: isGhost || isBreak ? 'dashed' : 'solid',
        borderColor: isGhost ? color : isBreak ? t.color.borderStrong : 'transparent',
        borderLeftWidth: block.kind === 'actual' ? 3 : isGhost ? 1.5 : isBreak ? 1 : 0,
        borderLeftColor: block.kind === 'actual' ? color : isGhost ? color : t.color.borderStrong,
        backgroundColor: isMeeting
          ? color
          : block.kind === 'actual'
            ? `${color}22`
            : isBreak
              ? t.color.sunk
              : 'transparent',
      }}
    >
      {px >= 24 && (
        <Text
          numberOfLines={1}
          style={{
            fontSize: t.fontSize['2xs'],
            fontWeight: '600',
            color: labelColor,
            fontStyle: isGhost ? 'italic' : 'normal',
          }}
        >
          {isGhost ? `◇ ${block.label}` : block.label}
        </Text>
      )}
      {px >= 40 && !isBreak && (
        <Text
          style={{
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize['2xs'],
            color: timeColor,
          }}
        >
          {clock(block.start)}–{clock(block.start + block.len)}
        </Text>
      )}
    </View>
  )
}

/** The left time gutter — hour labels aligned to the day-body grid. */
function HourGutter(): React.JSX.Element {
  const t = useTheme()
  const hours: number[] = []
  for (let h = START_HOUR + 1; h < END_HOUR; h++) hours.push(h)
  return (
    <View style={{ width: GUTTER }}>
      <View
        style={{ height: HEADER_HEIGHT, borderBottomWidth: 1, borderBottomColor: t.color.border }}
      />
      <View style={{ height: BODY_HEIGHT, position: 'relative' }}>
        {hours.map(h => (
          <Text
            key={h}
            style={{
              position: 'absolute',
              right: 8,
              top: (((h - START_HOUR) * 60) / SPAN) * BODY_HEIGHT - 7,
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize['2xs'],
              color: t.color.ink3,
            }}
          >
            {String(h).padStart(2, '0')}:00
          </Text>
        ))}
      </View>
    </View>
  )
}

/** One day column: header (name · date · total) + the canvas body with blocks. */
function DayColumn({
  day,
  index,
  flex,
}: {
  readonly day: DemoDay
  readonly index: number
  readonly flex: boolean
}): React.JSX.Element {
  const t = useTheme()
  const hours: number[] = []
  for (let h = START_HOUR + 1; h < END_HOUR; h++) hours.push(h)
  return (
    <View style={flex ? { flex: 1 } : { width: COL_WIDTH }}>
      <View
        style={{
          height: HEADER_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          borderBottomWidth: 1,
          borderBottomColor: t.color.border,
          borderLeftWidth: 1,
          borderLeftColor: t.color.border,
          backgroundColor: day.today ? t.color.accentSoft : 'transparent',
        }}
      >
        <Text
          style={{
            fontFamily: t.fontFamily.display,
            fontSize: t.fontSize.sm,
            fontWeight: '700',
            color: day.today ? t.color.accentText : t.color.ink,
          }}
        >
          {day.name}
        </Text>
        <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>{day.date}</Text>
        <Text
          style={{
            marginLeft: 'auto',
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize['2xs'],
            color: t.color.ink2,
          }}
        >
          {day.total}
        </Text>
      </View>
      <View
        style={{
          height: BODY_HEIGHT,
          position: 'relative',
          borderLeftWidth: 1,
          borderLeftColor: t.color.border,
          backgroundColor: day.today ? `${t.color.accentSoft}66` : 'transparent',
        }}
      >
        {hours.map(h => (
          <View
            key={h}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: (((h - START_HOUR) * 60) / SPAN) * BODY_HEIGHT,
              borderTopWidth: 1,
              borderTopColor: t.color.border,
              opacity: 0.55,
            }}
          />
        ))}
        {DEMO_BLOCKS.filter(b => b.day === index).map((b, i) => (
          <CanvasBlockView key={`${b.label}-${String(i)}`} block={b} />
        ))}
        {day.today && (
          <View
            style={{ position: 'absolute', left: 0, right: 0, top: (NOW_MIN / SPAN) * BODY_HEIGHT }}
            pointerEvents="none"
          >
            <View style={{ height: 2, backgroundColor: t.color.live }} />
            <View
              style={{
                position: 'absolute',
                left: -3,
                top: -4,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: t.color.live,
              }}
            />
            <View
              style={{
                position: 'absolute',
                right: 4,
                top: -9,
                paddingHorizontal: 7,
                paddingVertical: 1,
                borderRadius: t.radius.pill,
                backgroundColor: t.color.live,
              }}
            >
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize['2xs'],
                  fontWeight: '600',
                  color: '#ffffff',
                }}
              >
                14:20
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}

/** The bottom legend — swatch + label for each block kind. */
function Legend(): React.JSX.Element {
  const t = useTheme()
  const sample = projectColor('sync-engine', t.mode)
  const meeting = projectColor('nordwind', t.mode)
  const ghost = projectColor('reviews', t.mode)
  const Item = ({
    swatch,
    label,
  }: {
    readonly swatch: React.JSX.Element
    readonly label: string
  }): React.JSX.Element => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {swatch}
      <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>{label}</Text>
    </View>
  )
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
      <Item
        label="Gebucht"
        swatch={
          <View
            style={{
              width: 16,
              height: 11,
              borderRadius: 3,
              backgroundColor: `${sample}22`,
              borderLeftWidth: 3,
              borderLeftColor: sample,
            }}
          />
        }
      />
      <Item
        label="Meeting"
        swatch={
          <View style={{ width: 16, height: 11, borderRadius: 3, backgroundColor: meeting }} />
        }
      />
      <Item
        label="Vorschlag"
        swatch={
          <View
            style={{
              width: 16,
              height: 11,
              borderRadius: 3,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: ghost,
            }}
          />
        }
      />
      <Item
        label="Pause"
        swatch={
          <View
            style={{
              width: 16,
              height: 11,
              borderRadius: 3,
              backgroundColor: t.color.sunk,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: t.color.borderStrong,
            }}
          />
        }
      />
      <Item
        label="Jetzt"
        swatch={<View style={{ width: 16, height: 2, backgroundColor: t.color.live }} />}
      />
    </View>
  )
}

/** One labelled figure in the evening review, value in the numeric mono font. */
function ReviewMetric({
  label,
  value,
  tone,
}: {
  readonly label: string
  readonly value: string
  readonly tone: string
}): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>{label}</Text>
      <Text
        style={{
          fontFamily: t.fontFamily.numeric,
          fontSize: t.fontSize.md,
          fontWeight: '700',
          color: tone,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

/** Today's Co-Planner proposal (REQ-031): the deterministic core's ghost blocks. */
function CoPlannerProposal(): React.JSX.Element {
  const t = useTheme()
  const planner = usePlanner()
  const plan = planner.plan
  const span = planner.dayEndMin - planner.dayStartMin
  const [accepted, setAccepted] = useState<ReadonlySet<number>>(new Set())
  const [dismissed, setDismissed] = useState<ReadonlySet<number>>(new Set())

  const accept = (i: number): void => setAccepted(s => new Set(s).add(i))
  const dismiss = (i: number): void => setDismissed(s => new Set(s).add(i))
  const repropose = (): void => {
    setAccepted(new Set())
    setDismissed(new Set())
    planner.repropose()
  }

  const blockColor = (b: PlanBlock): string => {
    if (b.kind === 'meeting') return t.color.ink2
    if (b.kind === 'break') return t.color.ink3
    return projectColor(b.taskId ?? b.label, t.mode)
  }

  return (
    <Card
      title="Co-Planner — heute"
      subtitle="Vorschlag als Ghost-Blöcke — annehmen oder verwerfen"
      action={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          {!planner.live && <Badge tone="neutral">Demo-Daten</Badge>}
          <Button
            variant="secondary"
            size="sm"
            disabled={planner.briefingBusy || plan === null}
            onPress={() => planner.requestBriefing()}
          >
            {planner.briefingBusy ? '…' : 'KI-Briefing'}
          </Button>
          <Button variant="secondary" size="sm" disabled={planner.busy} onPress={repropose}>
            Neu vorschlagen
          </Button>
        </View>
      }
    >
      {planner.loading && plan === null ? (
        <Text style={{ color: t.color.ink2 }}>Dein Tag wird geplant …</Text>
      ) : planner.error ? (
        <Text style={{ color: t.color.crit }}>
          Planung fehlgeschlagen — {planner.error.message}
        </Text>
      ) : plan === null || plan.blocks.length === 0 ? (
        <Text style={{ color: t.color.ink2 }}>Noch kein Vorschlag.</Text>
      ) : (
        <>
          <View style={{ height: 320, position: 'relative' }}>
            {plan.blocks.map((b, i) => {
              if (dismissed.has(i)) return null
              const rect = plannerBlockRect(b.startMin - planner.dayStartMin, b.lenMin, span)
              const color = blockColor(b)
              const isGhost = b.kind !== 'meeting' && !accepted.has(i)
              return (
                <View
                  key={`${b.label}-${String(i)}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: rect.top * 320,
                    height: Math.max(rect.height * 320, 16),
                    borderRadius: t.radius.chip,
                    paddingHorizontal: t.spacing.s2,
                    justifyContent: 'center',
                    borderLeftWidth: isGhost ? 0 : 3,
                    borderLeftColor: color,
                    borderWidth: isGhost ? 1.5 : 0,
                    borderColor: color,
                    borderStyle: isGhost ? 'dashed' : 'solid',
                    backgroundColor: isGhost ? 'transparent' : `${color}22`,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: t.fontSize.xs,
                      color: isGhost ? color : t.color.ink,
                      fontWeight: isGhost ? '500' : '600',
                      fontStyle: isGhost ? 'italic' : 'normal',
                    }}
                  >
                    {b.kind === 'break' ? 'Pause' : isGhost ? `◇ ${b.label}` : b.label}
                  </Text>
                  {isGhost && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 5,
                        right: 6,
                        flexDirection: 'row',
                        gap: 4,
                      }}
                    >
                      <Pressable
                        onPress={() => accept(i)}
                        accessibilityRole="button"
                        accessibilityLabel={`Vorschlag annehmen: ${b.label}`}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: color,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="check" size={13} color="#ffffff" />
                      </Pressable>
                      <Pressable
                        onPress={() => dismiss(i)}
                        accessibilityRole="button"
                        accessibilityLabel={`Vorschlag verwerfen: ${b.label}`}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 1,
                          borderColor: color,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="x" size={13} color={color} />
                      </Pressable>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
          {(plan.droppedAnchors.length > 0 || plan.unplacedMin > 0) && (
            <View
              accessibilityRole="alert"
              style={{
                marginTop: t.spacing.s3,
                padding: t.spacing.s3,
                borderRadius: t.radius.block,
                borderWidth: 1,
                borderColor: t.color.warn,
                backgroundColor: t.color.raised,
                gap: t.spacing.s1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
                <Icon name="alert" size={14} color={t.color.warn} />
                <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.warn }}>
                  Tag überbucht
                </Text>
              </View>
              {plan.droppedAnchors.length > 0 && (
                <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
                  {plan.droppedAnchors.length === 1
                    ? '1 Termin überschneidet sich und wurde nicht eingeplant:'
                    : `${String(plan.droppedAnchors.length)} Termine überschneiden sich und wurden nicht eingeplant:`}{' '}
                  {plan.droppedAnchors.map(a => a.label).join(', ')}
                </Text>
              )}
              {plan.unplacedMin > 0 && (
                <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
                  {formatDuration(plan.unplacedMin * 60_000)} h Backlog fanden keinen Platz — kürze
                  Aufgaben, verschiebe Termine oder plane einen weiteren Tag ein.
                </Text>
              )}
            </View>
          )}
          {planner.briefing !== null && (
            <View
              style={{
                marginTop: t.spacing.s3,
                padding: t.spacing.s3,
                borderRadius: t.radius.block,
                backgroundColor: t.color.raised,
                borderWidth: 1,
                borderColor: t.color.border,
                gap: t.spacing.s1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
                <Icon name="assistant" size={14} color={t.color.accent} />
                <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink }}>
                  KI-Briefing
                </Text>
                <Badge tone={planner.briefing.source === 'ai-proposal' ? 'accent' : 'neutral'}>
                  {planner.briefing.source === 'ai-proposal' ? 'KI' : 'Zusammenfassung'}
                </Badge>
              </View>
              <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2, lineHeight: 20 }}>
                {planner.briefing.text}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3, marginTop: t.spacing.s2 }}>
            {formatDuration(plan.plannedFocusMin * 60_000)} h Fokus geplant
            {plan.unplacedMin > 0
              ? ` · ${formatDuration(plan.unplacedMin * 60_000)} h ohne Platz`
              : ''}
          </Text>
          {planner.review !== null && (
            <View
              style={{
                marginTop: t.spacing.s3,
                paddingTop: t.spacing.s3,
                borderTopWidth: 1,
                borderTopColor: t.color.border,
                gap: t.spacing.s2,
              }}
            >
              <Text
                style={{
                  fontSize: t.fontSize['2xs'],
                  fontWeight: '700',
                  color: t.color.ink3,
                  letterSpacing: t.fontSize['2xs'] * t.letterSpacing.wide,
                  textTransform: 'uppercase',
                }}
              >
                Abend-Review
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s5 }}>
                <ReviewMetric
                  label="Geplant"
                  value={`${formatDuration(planner.review.plannedFocusMin * 60_000)} h`}
                  tone={t.color.ink}
                />
                <ReviewMetric
                  label="Getrackt"
                  value={`${formatDuration(planner.review.trackedFocusMin * 60_000)} h`}
                  tone={t.color.ink}
                />
                <ReviewMetric
                  label="Drift"
                  value={`${planner.review.driftMin >= 0 ? '+' : '−'}${formatDuration(Math.abs(planner.review.driftMin) * 60_000)} h`}
                  tone={planner.review.driftMin >= 0 ? t.color.good : t.color.warn}
                />
              </View>
              <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
                {planner.review.driftMin >= 0
                  ? 'Im Plan oder darüber — starker Fokustag.'
                  : 'Unter dem geplanten Fokus — morgen ruhiger takten?'}
              </Text>
            </View>
          )}
        </>
      )}
    </Card>
  )
}

export function PlannerScreen(): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const stacked = width < STACK_BREAKPOINT
  const [week, setWeek] = useState(28)
  const [scope, setScope] = useState<'Zeiten' | 'Budgets'>('Zeiten')
  const [ask, setAsk] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)

  const submitAsk = (text: string): void => {
    const match = DEMO_ASK.find(s => s.q.toLowerCase() === text.trim().toLowerCase())
    setAsk(text)
    setAnswer(text.trim() === '' ? null : (match?.a ?? ASK_FALLBACK))
  }

  const scopeChip = (label: 'Zeiten' | 'Budgets'): React.JSX.Element => {
    const active = scope === label
    return (
      <Pressable
        onPress={() => setScope(label)}
        accessibilityRole="button"
        accessibilityLabel={`Kontext: ${label}`}
        style={{
          paddingVertical: 4,
          paddingHorizontal: 12,
          borderRadius: t.radius.pill,
          borderWidth: 1,
          borderColor: active ? t.color.accent : t.color.border,
          backgroundColor: active ? t.color.accentSoft : t.color.surface,
        }}
      >
        <Text
          style={{
            fontSize: t.fontSize['2xs'],
            fontWeight: '600',
            color: active ? t.color.accentText : t.color.ink2,
          }}
        >
          {label}
        </Text>
      </Pressable>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s4 }}
    >
      {/* Header — title · KW week selector · week total · plan action */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: t.spacing.s3,
          rowGap: t.spacing.s2,
        }}
      >
        <Text
          style={{
            flex: 1,
            minWidth: 140,
            fontWeight: '700',
            fontSize: t.fontSize.xl,
            color: t.color.ink,
            fontFamily: t.fontFamily.display,
            letterSpacing: t.fontSize.xl * t.letterSpacing.tight,
          }}
        >
          Planner
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            borderWidth: 1,
            borderColor: t.color.border,
            borderRadius: t.radius.pill,
            paddingVertical: 4,
            paddingHorizontal: 6,
            backgroundColor: t.color.surface,
          }}
        >
          <Pressable
            onPress={() => setWeek(w => w - 1)}
            accessibilityRole="button"
            accessibilityLabel="Vorherige Woche"
            style={{ padding: 2 }}
          >
            <Icon name="chevronLeft" size={16} color={t.color.ink2} />
          </Pressable>
          <Text
            style={{
              fontSize: t.fontSize.xs,
              fontWeight: '600',
              color: t.color.ink,
              minWidth: 46,
              textAlign: 'center',
            }}
          >
            KW {week}
          </Text>
          <Pressable
            onPress={() => setWeek(w => w + 1)}
            accessibilityRole="button"
            accessibilityLabel="Nächste Woche"
            style={{ padding: 2 }}
          >
            <Icon name="chevronRight" size={16} color={t.color.ink2} />
          </Pressable>
        </View>
        <Text
          style={{ fontFamily: t.fontFamily.numeric, fontSize: t.fontSize.xs, color: t.color.ink2 }}
        >
          <Text style={{ color: t.color.ink, fontWeight: '600' }}>26,1h</Text> / 41:40h
        </Text>
        <Button size="sm">Woche planen</Button>
      </View>

      {/* AI in context — reachable here, not only in the Assistant tab */}
      <View style={{ gap: t.spacing.s2, maxWidth: 680 }}>
        <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
          {scopeChip('Zeiten')}
          {scopeChip('Budgets')}
        </View>
        <AIAskBar
          value={ask}
          onChange={setAsk}
          onSubmit={() => submitAsk(ask)}
          placeholder="Frag zu deiner Woche …"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
          {DEMO_ASK.map(s => (
            <Pressable
              key={s.q}
              onPress={() => {
                setAsk(s.q)
                setAnswer(s.a)
              }}
              accessibilityRole="button"
              accessibilityLabel={s.q}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 10,
                borderRadius: t.radius.pill,
                borderWidth: 1,
                borderColor: t.color.border,
                backgroundColor: t.color.surface,
              }}
            >
              <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>{s.q}</Text>
            </Pressable>
          ))}
        </View>
        {answer !== null && <AICallout title="✦ Assistent">{answer}</AICallout>}
      </View>

      {/* Week canvas — plan (dashed) and actuals share one surface per day */}
      <Card padding={false}>
        <View style={{ flexDirection: 'row' }}>
          <HourGutter />
          {stacked ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row' }}>
                {DEMO_DAYS.map((day, di) => (
                  <DayColumn key={day.name} day={day} index={di} flex={false} />
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={{ flexDirection: 'row', flex: 1 }}>
              {DEMO_DAYS.map((day, di) => (
                <DayColumn key={day.name} day={day} index={di} flex />
              ))}
            </View>
          )}
        </View>
      </Card>

      <Legend />

      {/* TODO(design): drag-drop tracked in #117 */}
      <CoPlannerProposal />

      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3, lineHeight: 18 }}>
        Gestrichelte Blöcke sind Co-Planner-Vorschläge — ein Tippen übernimmt, verwerfen entfernt
        sie. Blöcke ziehen über Tage und Zeiten kommt mit der Interaktions-Spezifikation (#39).
      </Text>
    </ScrollView>
  )
}
