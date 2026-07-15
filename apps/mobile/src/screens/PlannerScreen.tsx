import { useRef, useState } from 'react'
import { PanResponder, Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import {
  assignLanes,
  dropTarget,
  findFreeSlot,
  formatDuration,
  maxConcurrency,
  plannerBlockRect,
  projectColor,
  snapDurationMin,
  type LanePlacement,
  type Theme,
} from '@mydevtime/design'
import { Text } from '../components/core/Text'
import {
  AICallout,
  AIAskBar,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  SegmentedControl,
} from '../components/index'
import { TaskInbox } from '../components/planner/TaskInbox'
import { useTheme } from '../theme/ThemeProvider'
import { usePlanner } from '../hooks/usePlanner'
import type { PlanBlock } from '../api/planner'
import { INBOX_PROJECTS, INBOX_TASKS, type InboxTask } from './plannerInboxData'

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
 * lands only on your tap. Blocks resize (bottom edge) and drag across days/times;
 * both snap to the 15-min grid and lanes/overbooking recompute live (design v6).
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
/** Calendar RSVP for a meeting: accepted (solid), tentative (hatched), fyi (dimmed, not counted). */
type Rsvp = 'accepted' | 'tentative' | 'fyi'

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
  /** RSVP for a synced meeting; drives the hatch / dim + badge (design v6). */
  readonly rsvp?: Rsvp
  /** External source label, e.g. "Outlook" → the ⇄ OL badge. */
  readonly ext?: string
  /** Recurring meeting → the ↻ glyph. */
  readonly rec?: boolean
}

interface DemoDay {
  readonly name: string
  readonly date: string
  readonly total: string
  readonly today?: boolean
}

const DEMO_DAYS: readonly DemoDay[] = [
  { name: 'Mo', date: '7.7.', total: '—' },
  { name: 'Di', date: '8.7.', total: '—', today: true },
  { name: 'Mi', date: '9.7.', total: '—' },
  { name: 'Do', date: '10.7.', total: '—' },
  { name: 'Fr', date: '11.7.', total: '—' },
]

/** day 0–4 · start/len in minutes from 08:00 · kind + project id for the color. */
const DEMO_BLOCKS: readonly CanvasBlock[] = []

const DEMO_ASK: readonly { readonly q: string; readonly a: string }[] = []

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

/** A tiny outlined glyph badge inside a block (↻ recurring, ⇄ OL, ? tentative, FYI). */
function BlockBadge({
  label,
  color,
  dotted = false,
}: {
  readonly label: string
  readonly color: string
  readonly dotted?: boolean
}): React.JSX.Element {
  return (
    <View
      style={{
        borderWidth: 1,
        borderStyle: dotted ? 'dotted' : 'solid',
        borderColor: color,
        borderRadius: 3,
        paddingHorizontal: 3,
        marginRight: 4,
      }}
    >
      <Text style={{ fontSize: 8, fontWeight: '800', color }}>{label}</Text>
    </View>
  )
}

/**
 * One absolutely-positioned block on a day column (canvas geometry, ADR-0005).
 * `placement` splits the column into lanes when blocks overlap (design v6
 * "Überbuchung"); meetings carry their RSVP state — tentative reads hollow, FYI
 * dims out and never counts — plus recurring (↻) and Outlook (⇄ OL) markers.
 */
function CanvasBlockView({
  block,
  placement,
  onResize,
  onMove,
  colWidth,
}: {
  readonly block: CanvasBlock
  readonly placement: LanePlacement
  /** Commit a new duration (minutes) when the bottom edge is dragged (design v6 A1). */
  readonly onResize?: ((lenMin: number) => void) | undefined
  /** Commit a new (day, startMin) when the block is dragged across days/times. */
  readonly onMove?: ((day: number, startMin: number) => void) | undefined
  /** One day column's on-screen width, to map a horizontal drag to day steps. */
  readonly colWidth: number
}): React.JSX.Element {
  const t = useTheme()
  const rect = plannerBlockRect(block.start, block.len, SPAN)
  const color = canvasBlockColor(t, block)
  const px = Math.max(rect.height * BODY_HEIGHT, 13)
  const isGhost = block.kind === 'ghost'
  const isMeeting = block.kind === 'meeting'
  const isBreak = block.kind === 'break'
  const tentative = isMeeting && block.rsvp === 'tentative'
  const fyi = isMeeting && block.rsvp === 'fyi'
  // A solid (accepted/plain) meeting fills; tentative/fyi read hollow.
  const solidMeeting = isMeeting && !tentative && !fyi

  // Resize gesture (A1): drag the bottom edge → new duration on the 15-min grid.
  // Live block start/len + callback are read through a ref so the PanResponder is
  // created once and never loses an in-flight drag to a re-render; snapping is the
  // pure `snapDurationMin` (ADR-0005). PanResponder works on web and native.
  const live = useRef({ start: block.start, len: block.len, onResize })
  live.current = { start: block.start, len: block.len, onResize }
  const grantLen = useRef(block.len)
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        grantLen.current = live.current.len
      },
      onPanResponderMove: (_e, g) => {
        const deltaMin = (g.dy * SPAN) / BODY_HEIGHT
        const next = snapDurationMin(grantLen.current + deltaMin, 15, 15, SPAN - live.current.start)
        live.current.onResize?.(next)
      },
    }),
  ).current

  // Move gesture (cross-day drag): pick the block up and drop it on another day /
  // time. The block translates by (dx, dy) while dragging — it stays in its column
  // so React never remounts it mid-gesture — and on release maps the delta to a new
  // (day, startMin): dx / colWidth → day steps, dy → minutes, both snapped to the
  // 15-min grid and clamped to the week. Deterministic mapping (ADR-0005).
  const moveLive = useRef({ day: block.day, start: block.start, len: block.len, colWidth, onMove })
  moveLive.current = { day: block.day, start: block.start, len: block.len, colWidth, onMove }
  const [dragXY, setDragXY] = useState<{ x: number; y: number } | null>(null)
  const dragResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        moveLive.current.onMove !== undefined && Math.abs(g.dx) + Math.abs(g.dy) > 6,
      onPanResponderMove: (_e, g) => setDragXY({ x: g.dx, y: g.dy }),
      onPanResponderRelease: (_e, g) => {
        const m = moveLive.current
        const { day, startMin } = dropTarget(
          g.dx,
          g.dy,
          { day: m.day, startMin: m.start, lenMin: m.len },
          {
            colWidth: m.colWidth,
            minPerPx: SPAN / BODY_HEIGHT,
            dayCount: DEMO_DAYS.length,
            spanMin: SPAN,
          },
        )
        setDragXY(null)
        if (day !== m.day || startMin !== m.start) m.onMove?.(day, startMin)
      },
      onPanResponderTerminate: () => setDragXY(null),
    }),
  ).current

  // Lane geometry: full width for a lone block, else an equal share with a small gap.
  const GUTTER_PAD = 4
  const laneStyle =
    placement.lanes <= 1
      ? { left: GUTTER_PAD, right: GUTTER_PAD }
      : {
          left: `${(placement.lane / placement.lanes) * 100}%` as const,
          width: `${100 / placement.lanes}%` as const,
        }

  const labelColor = solidMeeting
    ? '#ffffff'
    : fyi
      ? t.color.ink3
      : isGhost || tentative
        ? color
        : isBreak
          ? t.color.ink3
          : t.color.ink
  const timeColor = solidMeeting ? 'rgba(255,255,255,0.85)' : isGhost ? color : t.color.ink2
  const badgeColor = solidMeeting ? 'rgba(255,255,255,0.85)' : labelColor

  return (
    <View
      {...(onMove !== undefined ? dragResponder.panHandlers : {})}
      style={{
        position: 'absolute',
        top: rect.top * BODY_HEIGHT + 1,
        height: px,
        marginHorizontal: placement.lanes > 1 ? 1 : 0,
        ...laneStyle,
        ...(dragXY !== null
          ? { transform: [{ translateX: dragXY.x }, { translateY: dragXY.y }], zIndex: 30 }
          : null),
        borderRadius: t.radius.chip,
        paddingHorizontal: 7,
        paddingVertical: px >= 26 ? 4 : 0,
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: isGhost ? 1.5 : isBreak ? 1 : tentative ? 1.5 : fyi ? 1 : 0,
        borderStyle: isGhost || isBreak ? 'dashed' : fyi ? 'dotted' : 'solid',
        borderColor: isGhost
          ? color
          : isBreak
            ? t.color.borderStrong
            : tentative
              ? color
              : fyi
                ? t.color.borderStrong
                : 'transparent',
        borderLeftWidth: block.kind === 'actual' ? 3 : isGhost ? 1.5 : isBreak ? 1 : undefined,
        borderLeftColor:
          block.kind === 'actual'
            ? color
            : isGhost
              ? color
              : isBreak
                ? t.color.borderStrong
                : undefined,
        backgroundColor: solidMeeting
          ? color
          : block.kind === 'actual'
            ? `${color}22`
            : isBreak || fyi
              ? t.color.sunk
              : 'transparent',
        opacity: dragXY !== null ? 0.9 : fyi ? 0.85 : 1,
      }}
    >
      {px >= 24 && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {block.rec === true && <BlockBadge label="↻" color={badgeColor} />}
          {block.ext !== undefined && <BlockBadge label="⇄ OL" color={badgeColor} />}
          {tentative && <BlockBadge label="?" color={badgeColor} />}
          {fyi && <BlockBadge label="FYI" color={badgeColor} dotted />}
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: t.fontSize['2xs'],
              fontWeight: '600',
              color: labelColor,
              fontStyle: isGhost ? 'italic' : 'normal',
            }}
          >
            {isGhost ? `◇ ${block.label}` : block.label}
          </Text>
        </View>
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
      {onResize !== undefined && !isBreak && (
        <View
          {...responder.panHandlers}
          accessibilityLabel={`Dauer ändern: ${block.label}`}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 10 }}
        />
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
  blocks,
  colWidth,
  onResizeBlock,
  onMoveBlock,
}: {
  readonly day: DemoDay
  readonly index: number
  readonly flex: boolean
  readonly blocks: readonly CanvasBlock[]
  /** One day column's on-screen width, for the cross-day drag mapping. */
  readonly colWidth: number
  /** Commit a resized duration by the block's index in the shared list. */
  readonly onResizeBlock: (globalIndex: number, lenMin: number) => void
  /** Commit a moved (day, startMin) by the block's index in the shared list. */
  readonly onMoveBlock: (globalIndex: number, day: number, startMin: number) => void
}): React.JSX.Element {
  const t = useTheme()
  const hours: number[] = []
  for (let h = START_HOUR + 1; h < END_HOUR; h++) hours.push(h)
  // Keep each block's index in the shared list so a resize maps back to it.
  const dayEntries = blocks
    .map((b, globalIndex) => ({ b, globalIndex }))
    .filter(x => x.b.day === index)
  const dayBlocks = dayEntries.map(x => x.b)
  // Lanes split the column when blocks overlap; the badge counts real conflicts —
  // breaks and FYI meetings never count (design v6).
  const placements = assignLanes(dayBlocks.map(b => ({ startMin: b.start, lenMin: b.len })))
  const conflictPeak = maxConcurrency(
    dayBlocks
      .filter(b => b.kind !== 'break' && b.rsvp !== 'fyi')
      .map(b => ({ startMin: b.start, lenMin: b.len })),
  )
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
        {conflictPeak >= 2 && (
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: t.radius.pill,
              backgroundColor: t.color.warnSoft,
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: '800', color: t.color.warn }}>
              {conflictPeak}×
            </Text>
          </View>
        )}
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
        {dayEntries.map(({ b, globalIndex }, i) => (
          <CanvasBlockView
            key={`${b.label}-${String(i)}`}
            block={b}
            placement={placements[i] ?? { lane: 0, lanes: 1 }}
            colWidth={colWidth}
            onResize={len => onResizeBlock(globalIndex, len)}
            onMove={(day, start) => onMoveBlock(globalIndex, day, start)}
          />
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
  const [view, setView] = useState<'Woche' | 'Monat' | 'Jahr'>('Woche')
  // The week canvas blocks are local, resizable state (design v6 A1) — dragging a
  // block's bottom edge commits a new 15-min-snapped duration. Demo data for now.
  const [blocks, setBlocks] = useState<readonly CanvasBlock[]>(DEMO_BLOCKS)
  // One day column's on-screen width, measured from the columns row, so a horizontal
  // drag maps to whole-day steps. Falls back to the fixed width on the phone canvas.
  const [colWidth, setColWidth] = useState(COL_WIDTH)
  const resizeBlock = (globalIndex: number, lenMin: number): void =>
    setBlocks(bs => bs.map((b, i) => (i === globalIndex ? { ...b, len: lenMin } : b)))
  const moveBlock = (globalIndex: number, day: number, startMin: number): void =>
    setBlocks(bs => bs.map((b, i) => (i === globalIndex ? { ...b, day, start: startMin } : b)))

  // Task-Inbox (design v6): assigned tickets; "Planen" drops one into the next free
  // slot as a ghost proposal (deterministic `findFreeSlot` — ADR-0005), never onto a
  // busy slot; a full week says so honestly instead of silently dropping the task.
  const [tasks, setTasks] = useState<readonly InboxTask[]>(INBOX_TASKS)
  const [inboxOpen, setInboxOpen] = useState(true)
  const [inboxNote, setInboxNote] = useState<string | null>(null)
  const doneTask = (task: InboxTask): void => setTasks(ts => ts.filter(x => x.key !== task.key))
  const planTask = (task: InboxTask): void => {
    const lenMin = Math.round(task.est * 60)
    for (let day = 0; day < DEMO_DAYS.length; day++) {
      const occupied = blocks
        .filter(b => b.day === day)
        .map(b => ({ startMin: b.start, lenMin: b.len }))
      // On today (day 1), don't propose a slot that has already elapsed.
      const notBefore = DEMO_DAYS[day]?.today === true ? NOW_MIN : 0
      const start = findFreeSlot(occupied, lenMin, 0, SPAN, notBefore)
      if (start !== null) {
        setBlocks(bs => [
          ...bs,
          {
            day,
            start,
            len: lenMin,
            label: `${task.key} · ${task.title}`,
            kind: 'ghost',
            project: INBOX_PROJECTS[task.project]?.id ?? task.key,
          },
        ])
        setTasks(ts => ts.filter(x => x.key !== task.key))
        setInboxNote(`${task.key} eingeplant — ${DEMO_DAYS[day]?.name ?? ''} ${clock(start)}.`)
        return
      }
    }
    setInboxNote(`Kein freier Slot in KW ${String(week)} — „${task.key}" bleibt in der Inbox.`)
  }
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
        <View style={{ maxWidth: 260, minWidth: 200, flexGrow: 1 }}>
          <SegmentedControl
            segments={[
              { value: 'Woche', label: 'Woche' },
              { value: 'Monat', label: 'Monat' },
              { value: 'Jahr', label: 'Jahr' },
            ]}
            active={view}
            onChange={setView}
          />
        </View>
        {view === 'Woche' && (
          <>
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
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize.xs,
                color: t.color.ink2,
              }}
            >
              <Text style={{ color: t.color.ink, fontWeight: '600' }}>26,1h</Text> / 41:40h
            </Text>
          </>
        )}
        {view === 'Woche' && (
          <Button
            size="sm"
            variant={inboxOpen ? 'primary' : 'ghost'}
            onPress={() => setInboxOpen(o => !o)}
          >
            {`Inbox · ${String(tasks.length)}`}
          </Button>
        )}
        <Button size="sm">
          {view === 'Jahr' ? 'Jahr planen' : view === 'Monat' ? 'Monat planen' : 'Woche planen'}
        </Button>
      </View>

      {view === 'Monat' && (
        <Card>
          <EmptyState
            title="Monatsansicht — bald verfügbar"
            hint="Die geplante Last pro Tag über den Monat erscheint hier, sobald die Auslastungs-Aggregation live ist."
          />
        </Card>
      )}

      {view === 'Jahr' && (
        <Card>
          <EmptyState
            title="Jahresansicht — bald verfügbar"
            hint="Die Wochen-Intensität über das Jahr erscheint hier, sobald die Auslastungs-Aggregation live ist."
          />
        </Card>
      )}

      {view === 'Woche' && (
        <>
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

          {inboxNote !== null && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.s2,
                paddingVertical: t.spacing.s2,
                paddingHorizontal: t.spacing.s3,
                borderRadius: t.radius.block,
                borderWidth: 1,
                borderColor: t.color.border,
                backgroundColor: t.color.surface,
              }}
            >
              <Text style={{ flex: 1, fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>
                ✦ {inboxNote}
              </Text>
              <Button size="sm" variant="ghost" onPress={() => setInboxNote(null)}>
                OK
              </Button>
            </View>
          )}

          {/* Week canvas + Task-Inbox rail — plan (dashed) and actuals share one
              surface per day; the inbox sits beside it on wide screens. */}
          <View
            style={{
              flexDirection: stacked ? 'column' : 'row',
              gap: t.spacing.s4,
              alignItems: 'flex-start',
            }}
          >
            <Card padding={false} style={{ flex: stacked ? undefined : 1, alignSelf: 'stretch' }}>
              <View style={{ flexDirection: 'row' }}>
                <HourGutter />
                {stacked ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row' }}>
                      {DEMO_DAYS.map((day, di) => (
                        <DayColumn
                          key={day.name}
                          day={day}
                          index={di}
                          flex={false}
                          blocks={blocks}
                          colWidth={COL_WIDTH}
                          onResizeBlock={resizeBlock}
                          onMoveBlock={moveBlock}
                        />
                      ))}
                    </View>
                  </ScrollView>
                ) : (
                  <View
                    style={{ flexDirection: 'row', flex: 1 }}
                    onLayout={e => {
                      const w = e.nativeEvent.layout.width / DEMO_DAYS.length
                      if (w > 0) setColWidth(w)
                    }}
                  >
                    {DEMO_DAYS.map((day, di) => (
                      <DayColumn
                        key={day.name}
                        day={day}
                        index={di}
                        flex
                        blocks={blocks}
                        colWidth={colWidth}
                        onResizeBlock={resizeBlock}
                        onMoveBlock={moveBlock}
                      />
                    ))}
                  </View>
                )}
              </View>
            </Card>
            {inboxOpen && <TaskInbox tasks={tasks} onPlan={planTask} onDone={doneTask} />}
          </View>

          <Legend />

          <CoPlannerProposal />

          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3, lineHeight: 18 }}>
            Blöcke ziehen (über Tage &amp; Zeiten) oder an der Unterkante in der Dauer ändern —
            beides rastet auf 15 min. Überlappende Blöcke teilen sich die Spalte (Lanes); der
            „N×"-Chip im Tageskopf zählt echte Konflikte (Pausen &amp; FYI zählen nicht). ↻
            wiederkehrend · ⇄ OL = Outlook · ? = Vorbehalt · FYI = ohne Teilnahme. Gestrichelte
            Blöcke sind Co-Planner-Vorschläge.
          </Text>
        </>
      )}
    </ScrollView>
  )
}
