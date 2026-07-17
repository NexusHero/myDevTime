import { FlashList } from '@shopify/flash-list'
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import {
  assignLanes,
  dropTarget,
  findFreeSlot,
  cascadeFreeSlots,
  formatDuration,
  maxConcurrency,
  plannerBlockRect,
  projectColor,
  snapDurationMin,
  type LanePlacement,
  type Theme,
} from '@mydevtime/design'
import {
  detectUnbookedGap,
  pickBanner,
  realityDrift,
  type RealityGap,
  type RecurrenceRule,
  type TimedSpan,
} from '@mydevtime/domain'
import { ContextBanner, type ContextBannerProps } from '../components/planner/ContextBanner'
import { priceWeekFromBlocks } from '../planner/weekPrice'
import { weekCapacityFromBlocks } from '../planner/capacityTrace'
import { inLayer, PLANNER_LAYERS, type PlannerLayer } from '../planner/layer'
import { apiBaseUrl } from '../config'
import { createSeries } from '../api/recurrence'
import { occurrencesToBlocks, type RecurringBlock } from '../planner/recurring'
import { useWeekOccurrences } from '../hooks/useWeekOccurrences'
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
import { PlannerEntryDrawer, type DrawerEntry } from '../components/planner/PlannerEntryDrawer'
import { useTheme } from '../theme/ThemeProvider'
import { usePlanner } from '../hooks/usePlanner'
import { usePreferences } from '../hooks/usePreferences'
import { loadDaySpans, localDayKey } from '../autotracker/dayActivityStore'
import type { PlanBlock } from '../api/planner'
import { INBOX_PROJECTS, INBOX_TASKS, type InboxTask } from './plannerInboxData'

/**
 * Planner — the week view of day canvases (ux-vision §2.1/§3, issue #11), ported
 * 1:1 from the design system's `PlannerScreen`: a header with the KW week
 * selector and week-total, an in-context AI ask bar (AI is reachable here, not
 * just in the Assistant tab), the week canvas where plan (dashed ghost blocks —
 * REQ-031) and actuals (solid, project-colored) share one surface per day so
 * drift is visible by *looking*, the red `--live` "Now" now-line, the live
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
/** "Now" — the real current time, in minutes from 08:00, clamped to the window. */
const NOW = new Date()
const NOW_MIN = Math.max(0, Math.min((NOW.getHours() - START_HOUR) * 60 + NOW.getMinutes(), SPAN))

type CanvasKind = 'actual' | 'meeting' | 'ghost' | 'break' | 'life'
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
  /** The 🛡 protection flag (design v14 D14): mutes own nudges; also consumes capacity. */
  readonly protectedFlag?: boolean
}

interface DemoDay {
  readonly name: string
  readonly date: string
  readonly total: string
  readonly today?: boolean
  /** Local midnight (ms) of this day — the anchor for mapping reality spans onto the
   *  canvas window (ADR-0064, K1). The day's 08:00 window start is `dateMs + START_HOUR·h`. */
  readonly dateMs: number
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const
const WEEK_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const

/** The real current Mon–Fri work week, with `today` flagged on the matching date. */
function buildWeek(): readonly DemoDay[] {
  const now = new Date()
  const monday = new Date(now)
  const daysSinceMonday = (now.getDay() + 6) % 7
  monday.setDate(now.getDate() - daysSinceMonday)
  monday.setHours(0, 0, 0, 0)
  const todayKey = now.toDateString()
  return WEEK_DAY_NAMES.map((name, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return {
      name,
      date: `${MONTH_SHORT[d.getMonth()] ?? ''} ${String(d.getDate())}`,
      total: '—',
      today: d.toDateString() === todayKey,
      dateMs: d.getTime(),
    }
  })
}

const weekDays = buildWeek()

/** The real ISO-8601 calendar week number for a date (KW), so the header never
 *  shows an arbitrary counter — the canvas always renders the current week. */
function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3_600_000))
}

const CURRENT_WEEK = isoWeek(new Date())

/** day 0–4 · start/len in minutes from 08:00 · kind + project id for the color. */
const DEMO_BLOCKS: readonly CanvasBlock[] = []

function canvasBlockColor(t: Theme, b: CanvasBlock): string {
  // Life blocks (design v14 §F) wear the sage `--life` token — family is not a project, so it
  // never borrows a project color. Its time reduces the plannable capacity (the head-trace).
  if (b.kind === 'life') return t.color.life
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
 * "overbooking"); meetings carry their RSVP state — tentative reads hollow, FYI
 * dims out and never counts — plus recurring (↻) and Outlook (⇄ OL) markers.
 */
function CanvasBlockView({
  block,
  placement,
  onResize,
  onMove,
  onOpen,
  colWidth,
}: {
  readonly block: CanvasBlock
  readonly placement: LanePlacement
  /** Commit a new duration (minutes) when the bottom edge is dragged (design v6 A1). */
  readonly onResize?: ((lenMin: number) => void) | undefined
  /** Commit a new (day, startMin) when the block is dragged across days/times. */
  readonly onMove?: ((day: number, startMin: number) => void) | undefined
  /** Open the typed entry drawer for this block (ADR-0063, H2) — a tap, not a drag. */
  readonly onOpen?: (() => void) | undefined
  /** One day column's on-screen width, to map a horizontal drag to day steps. */
  readonly colWidth: number
}): React.JSX.Element {
  const t = useTheme()
  const [hovered, setHovered] = useState(false)
  const rect = plannerBlockRect(block.start, block.len, SPAN)
  const color = canvasBlockColor(t, block)
  const px = Math.max(rect.height * BODY_HEIGHT, 13)
  const isGhost = block.kind === 'ghost'
  const isMeeting = block.kind === 'meeting'
  const isBreak = block.kind === 'break'
  const tentative = isMeeting && block.rsvp === 'tentative'
  const fyi = isMeeting && block.rsvp === 'fyi'
  const solidMeeting = isMeeting && !tentative && !fyi

  // Reanimated shared values
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  const isDragging = useSharedValue(false)
  const isResizing = useSharedValue(false)

  // Move action via worklet/JS
  const handleMove = (dx: number, dy: number) => {
    const { day, startMin } = dropTarget(
      dx,
      dy,
      { day: block.day, startMin: block.start, lenMin: block.len },
      {
        colWidth,
        minPerPx: SPAN / BODY_HEIGHT,
        dayCount: 5, // Defaulting to 5 for now since weekDays is length 5
        spanMin: SPAN,
      },
    )
    if (day !== block.day || startMin !== block.start) {
      onMove?.(day, startMin)
    }
  }

  const handleResize = (dy: number) => {
    const deltaMin = (dy * SPAN) / BODY_HEIGHT
    const next = snapDurationMin(block.len + deltaMin, 15, 15, SPAN - block.start)
    onResize?.(next)
  }

  const [dragPreview, setDragPreview] = useState<{ startMin: number } | null>(null)

  const moveGesture = Gesture.Pan()
    .enabled(onMove !== undefined)
    .onStart(() => {
      isDragging.value = true
    })
    .onUpdate(e => {
      dragX.value = e.translationX
      dragY.value = e.translationY
      runOnJS(setDragPreview)(
        dropTarget(
          e.translationX,
          e.translationY,
          { day: block.day, startMin: block.start, lenMin: block.len },
          { colWidth, minPerPx: SPAN / BODY_HEIGHT, dayCount: 5, spanMin: SPAN },
        ),
      )
    })
    .onEnd(e => {
      runOnJS(handleMove)(e.translationX, e.translationY)
      dragX.value = 0
      dragY.value = 0
      isDragging.value = false
      runOnJS(setDragPreview)(null)
    })

  const resizeGesture = Gesture.Pan()
    .enabled(onResize !== undefined)
    .onStart(() => {
      isResizing.value = true
    })
    .onUpdate(e => {
      runOnJS(handleResize)(e.translationY)
    })
    .onEnd(() => {
      isResizing.value = false
    })

  const animStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: dragX.value }, { translateY: dragY.value }],
      zIndex: isDragging.value ? 30 : 0,
      opacity: isDragging.value ? 0.9 : fyi ? 0.85 : 1,
    }
  })

  const resizeLiveTimeStyle = useAnimatedStyle(() => {
    return {
      opacity: isResizing.value || isDragging.value ? 1 : 0,
    }
  })

  const popped = hovered && placement.lanes > 1 && dragPreview === null
  const GUTTER_PAD = 4
  const laneStyle =
    placement.lanes <= 1 || popped
      ? { left: GUTTER_PAD, right: GUTTER_PAD }
      : {
          left: `${(placement.lane / placement.lanes) * 100}%` as const,
          width: `${100 / placement.lanes}%` as const,
        }
  const elevatedShadow = {
    shadowColor: t.color.ink,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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

  const baseBg = solidMeeting
    ? color
    : block.kind === 'actual'
      ? `${color}22`
      : isBreak || fyi
        ? t.color.sunk
        : 'transparent'
  const backgroundColor = popped && baseBg === 'transparent' ? t.color.surface : baseBg

  const showTime = true
  const previewStart = dragPreview?.startMin ?? block.start

  return (
    <Animated.View
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={[
        {
          position: 'absolute',
          top: rect.top * BODY_HEIGHT + 1,
          height: px,
          marginHorizontal: placement.lanes > 1 && !popped ? 1 : 0,
          ...laneStyle,
          ...(popped ? { zIndex: 20, ...elevatedShadow } : null),
          borderRadius: t.radius.chip,
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
          backgroundColor,
        },
        animStyle,
      ]}
    >
      <GestureDetector gesture={moveGesture}>
        <Animated.View style={{ flex: 1 }}>
          <Pressable
            onPress={onOpen}
            disabled={onOpen === undefined}
            accessibilityRole="button"
            accessibilityLabel={`Open ${block.label}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: 7,
              paddingVertical: px >= 26 ? 4 : 0,
              justifyContent: 'center',
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
          </Pressable>
        </Animated.View>
      </GestureDetector>

      {showTime && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 1,
              right: 1,
              zIndex: 40,
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: t.radius.pill,
              backgroundColor: t.color.ink,
            },
            resizeLiveTimeStyle,
          ]}
          pointerEvents="none"
        >
          <Text
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize['2xs'],
              fontWeight: '700',
              color: t.color.bg,
            }}
          >
            {clock(previewStart)}–{clock(previewStart + block.len)}
          </Text>
        </Animated.View>
      )}
      {onResize !== undefined && !isBreak && (
        <GestureDetector gesture={resizeGesture}>
          <Animated.View
            accessibilityLabel={`Change duration: ${block.label}`}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 10 }}
          />
        </GestureDetector>
      )}
    </Animated.View>
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

/** How the auto-tracker's reality maps onto one day column (ADR-0064, K1). */
interface DayRealityView {
  /** Active spans as positioned trace rects (top/height as fractions of the window). */
  readonly segments: readonly { readonly top: number; readonly height: number }[]
  /** Signed drift vs the day's booked time (tracked − booked), in ms. */
  readonly driftMs: number
}

/**
 * Build a day's reality overlay from its captured spans + booked (actual) blocks. Pure:
 * active spans (idle/away excluded) clipped to the 08:00–18:00 window become trace rects,
 * and the deterministic `realityDrift` gives the day-head chip's signed delta.
 */
function dayRealityView(
  spans: readonly TimedSpan[],
  dayBlocks: readonly CanvasBlock[],
  windowStartMs: number,
): DayRealityView {
  const segments: { top: number; height: number }[] = []
  for (const s of spans) {
    if (s.source === 'Idle' || s.source === 'Away') continue
    const startMin = Math.max(0, (s.startMs - windowStartMs) / 60_000)
    const endMin = Math.min(SPAN, (s.endMs - windowStartMs) / 60_000)
    if (endMin <= startMin) continue
    const rect = plannerBlockRect(startMin, endMin - startMin, SPAN)
    segments.push({ top: rect.top, height: rect.height })
  }
  const bookedMs = dayBlocks
    .filter(b => b.kind === 'actual')
    .reduce((n, b) => n + b.len * 60_000, 0)
  return { segments, driftMs: realityDrift(spans, bookedMs).deltaMs }
}

/** A drift as a compact signed `+H:MM` / `−H:MM` label for the day-head chip. */
function driftLabel(ms: number): string {
  const mins = Math.round(Math.abs(ms) / 60_000)
  const sign = ms >= 0 ? '+' : '−'
  return `${sign}${String(Math.floor(mins / 60))}:${String(mins % 60).padStart(2, '0')}`
}

// Yesterday-healing "seen" flag (ADR-0064, K3): a tiny local marker so the banner
// shows at most once per day — adopted or dismissed, it does not nag again. Local-only.
const HEAL_KEY = 'mydevtime.planner.healed.'
function healSeen(dayKey: string): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(HEAL_KEY + dayKey) === '1'
  } catch {
    return false
  }
}
function markHealSeen(dayKey: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(HEAL_KEY + dayKey, '1')
  } catch {
    /* best-effort; a private-mode failure just means the banner may show again */
  }
}

/** One day column: header (name · date · total) + the canvas body with blocks. */
function DayColumn({
  day,
  index,
  flex,
  blocks,
  recurring,
  colWidth,
  onResizeBlock,
  onMoveBlock,
  onOpenBlock,
  showReality,
}: {
  readonly day: DemoDay
  readonly index: number
  readonly flex: boolean
  readonly blocks: readonly CanvasBlock[]
  /** Recurring-series occurrences for the week (design v17 §F4) — read-only ↻ ghosts, not
   *  part of the editable block list, so they never touch the drag/index model. */
  readonly recurring: readonly RecurringBlock[]
  /** One day column's on-screen width, for the cross-day drag mapping. */
  readonly colWidth: number
  /** Commit a resized duration by the block's index in the shared list. */
  readonly onResizeBlock: (globalIndex: number, lenMin: number) => void
  /** Commit a moved (day, startMin) by the block's index in the shared list. */
  readonly onMoveBlock: (globalIndex: number, day: number, startMin: number) => void
  /** Open the typed entry drawer for a block by its index (ADR-0063, H2). */
  readonly onOpenBlock: (globalIndex: number) => void
  /** Overlay the auto-tracker's reality trace + drift chip (ADR-0064, K1). */
  readonly showReality: boolean
}): React.JSX.Element {
  const t = useTheme()
  const hours: number[] = []
  for (let h = START_HOUR + 1; h < END_HOUR; h++) hours.push(h)
  // Keep each block's index in the shared list so a resize maps back to it.
  const dayEntries = blocks
    .map((b, globalIndex) => ({ b, globalIndex }))
    .filter(x => x.b.day === index)
  const dayBlocks = dayEntries.map(x => x.b)
  // Recurring occurrences for this day (design v17 §F4) — read-only ↻ ghosts.
  const dayRecurring = recurring.filter(rb => rb.day === index)
  // Lanes split the column when blocks overlap; the badge counts real conflicts —
  // breaks and FYI meetings never count (design v6).
  const placements = assignLanes(dayBlocks.map(b => ({ startMin: b.start, lenMin: b.len })))
  const conflictPeak = maxConcurrency(
    dayBlocks
      .filter(b => b.kind !== 'break' && b.rsvp !== 'fyi')
      .map(b => ({ startMin: b.start, lenMin: b.len })),
  )
  // Reality overlay (ADR-0064, K1): the auto-tracker's active spans for this day,
  // positioned on the window, plus the signed drift vs the day's booked time. Read
  // from the local per-day history; null (no overlay) when the toggle is off.
  const reality = showReality
    ? dayRealityView(
        loadDaySpans(localDayKey(day.dateMs)),
        dayBlocks,
        day.dateMs + START_HOUR * 3_600_000,
      )
    : null
  const hasReality = reality !== null && reality.segments.length > 0
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
        {hasReality && reality !== null && (
          <View
            accessibilityRole="text"
            accessibilityLabel={`Reality drift ${driftLabel(reality.driftMs)}`}
            style={{
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: t.radius.pill,
              backgroundColor: t.color.liveSoft,
            }}
          >
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: 9,
                fontWeight: '800',
                color: t.color.live,
              }}
            >
              {driftLabel(reality.driftMs)}
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
        {/* 30-min dotted hairlines — a finer grid for the 15-min snapping (design v6). */}
        {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => 30 + i * 60).map(min => (
          <View
            key={`half-${String(min)}`}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: (min / SPAN) * BODY_HEIGHT,
              borderTopWidth: 1,
              borderTopColor: t.color.border,
              borderStyle: 'dotted',
              opacity: 0.25,
            }}
          />
        ))}
        {/* Reality trace (ADR-0064, K1): the auto-tracker's active spans as a slim
            neutral strip on the day column's right edge — observed, not booked, so it
            reads muted (never a project fill). Plan and reality on one surface. */}
        {reality?.segments.map((seg, i) => (
          <View
            key={`reality-${String(i)}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: 2,
              width: 4,
              borderRadius: 2,
              top: seg.top * BODY_HEIGHT + 1,
              height: Math.max(seg.height * BODY_HEIGHT, 2),
              backgroundColor: t.color.ink3,
              opacity: 0.7,
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
            onOpen={() => onOpenBlock(globalIndex)}
          />
        ))}
        {/* Recurring occurrences (design v17 §F4): projected from a stored series, so they are
            read-only ↻ ghosts (dashed, muted) — never editable canvas blocks. Positioned on the
            window like reality; `pointerEvents="none"` keeps them off the drag/index model. */}
        {dayRecurring.map((rb, i) => (
          <View
            key={`rec-${String(rb.start)}-${String(i)}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 2,
              right: 8,
              top: (rb.start / SPAN) * BODY_HEIGHT + 1,
              height: Math.max((rb.len / SPAN) * BODY_HEIGHT - 2, 12),
              borderRadius: t.radius.block,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: t.color.border,
              backgroundColor: t.color.surface,
              opacity: 0.85,
              paddingHorizontal: 6,
              paddingVertical: 2,
              overflow: 'hidden',
            }}
          >
            <Text
              numberOfLines={1}
              style={{ fontSize: t.fontSize['2xs'], fontWeight: '600', color: t.color.ink2 }}
            >
              {`↻ ${rb.label}`}
            </Text>
          </View>
        ))}
        {day.today && (
          <View
            style={{ position: 'absolute', left: 0, right: 0, top: (NOW_MIN / SPAN) * BODY_HEIGHT }}
            pointerEvents="none"
          >
            <View
              style={{
                height: 2,
                backgroundColor: t.color.live,
                shadowColor: t.color.live,
                shadowOpacity: 0.6,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 0 },
                elevation: 2,
              }}
            />
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
                {clock(NOW_MIN)}
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
        label="Booked"
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
        label="Proposal"
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
        label="Now"
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
      title="Co-Planner — today"
      subtitle="Proposal as ghost blocks — accept or dismiss"
      action={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          <Button
            variant="secondary"
            size="sm"
            disabled={planner.briefingBusy || plan === null}
            onPress={() => planner.requestBriefing()}
          >
            {planner.briefingBusy ? '…' : 'AI briefing'}
          </Button>
          <Button variant="secondary" size="sm" disabled={planner.busy} onPress={repropose}>
            Propose again
          </Button>
        </View>
      }
    >
      {planner.loading && plan === null ? (
        <Text style={{ color: t.color.ink2 }}>Planning your day…</Text>
      ) : planner.error ? (
        <Text style={{ color: t.color.crit }}>Planning failed — {planner.error.message}</Text>
      ) : plan === null || plan.blocks.length === 0 ? (
        <Text style={{ color: t.color.ink2 }}>No proposal yet.</Text>
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
                        accessibilityLabel={`Accept proposal: ${b.label}`}
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
                        accessibilityLabel={`Dismiss proposal: ${b.label}`}
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
                  Day overbooked
                </Text>
              </View>
              {plan.droppedAnchors.length > 0 && (
                <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
                  {plan.droppedAnchors.length === 1
                    ? '1 appointment overlaps and was not scheduled:'
                    : `${String(plan.droppedAnchors.length)} appointments overlap and were not scheduled:`}{' '}
                  {plan.droppedAnchors.map(a => a.label).join(', ')}
                </Text>
              )}
              {plan.unplacedMin > 0 && (
                <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
                  {formatDuration(plan.unplacedMin * 60_000)} h of backlog didn&apos;t fit — shorten
                  tasks, move appointments, or schedule another day.
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
                  AI briefing
                </Text>
                <Badge tone={planner.briefing.source === 'ai-proposal' ? 'accent' : 'neutral'}>
                  {planner.briefing.source === 'ai-proposal' ? 'AI' : 'Summary'}
                </Badge>
              </View>
              <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2, lineHeight: 20 }}>
                {planner.briefing.text}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3, marginTop: t.spacing.s2 }}>
            {formatDuration(plan.plannedFocusMin * 60_000)} h focus planned
            {plan.unplacedMin > 0
              ? ` · ${formatDuration(plan.unplacedMin * 60_000)} h no slot`
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
                Evening review
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s5 }}>
                <ReviewMetric
                  label="Planned"
                  value={`${formatDuration(planner.review.plannedFocusMin * 60_000)} h`}
                  tone={t.color.ink}
                />
                <ReviewMetric
                  label="Tracked"
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
                  ? 'On plan or above — strong focus day.'
                  : 'Below planned focus — pace tomorrow more gently?'}
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
  // The canvas always shows the real current week; the header labels its ISO week
  // number (KW) — no prev/next affordance that changes a counter but not the data.
  const week = CURRENT_WEEK
  const [view, setView] = useState<'Week' | 'Month' | 'Year'>('Week')
  // Work / Life / Both layer filter (design v17 §F6.5). One person, one timeline:
  // work and life share the calendar, and this filter only changes what is *shown*,
  // never what exists — capacity and price still read the full block set below.
  const [layer, setLayer] = useState<PlannerLayer>('both')
  // The week canvas blocks are local, resizable state (design v6 A1) — dragging a
  // block's bottom edge commits a new 15-min-snapped duration. Demo data for now.
  const [blocks, setBlocks] = useState<readonly CanvasBlock[]>(DEMO_BLOCKS)
  // Reality layer (ADR-0064, K1): the "● Reality" toggle overlays the auto-tracker's
  // observed activity on the canvas. Gated on the `autoTracker` consent — with it off
  // there is nothing to show, so the overlay stays dark and the toggle guides to Settings.
  const { prefs } = usePreferences()
  const [realityOn, setRealityOn] = useState(false)
  const showReality = realityOn && prefs.autoTracker
  // Yesterday-healing (ADR-0064, K3): on first open, if the auto-tracker saw a stretch
  // yesterday that was never booked, offer to book it (once per day, ≥15 min). "Yesterday"
  // is the weekday column left of today, so Adopt maps onto a visible day. Consent-gated.
  const [healGap, setHealGap] = useState<{
    readonly gap: RealityGap
    readonly dayIndex: number
    readonly dateMs: number
  } | null>(null)
  // One day column's on-screen width, measured from the columns row, so a horizontal
  // drag maps to whole-day steps. Falls back to the fixed width on the phone canvas.
  const [colWidth, setColWidth] = useState(COL_WIDTH)
  const resizeBlock = (globalIndex: number, lenMin: number): void =>
    setBlocks(bs => bs.map((b, i) => (i === globalIndex ? { ...b, len: lenMin } : b)))
  const moveBlock = (globalIndex: number, day: number, startMin: number): void =>
    setBlocks(bs => bs.map((b, i) => (i === globalIndex ? { ...b, day, start: startMin } : b)))

  // Typed entry drawer (ADR-0063, H2): a tap on a block opens it, typed by kind, and
  // every action mutates the real block state — attendance, delete, accept/dismiss a
  // Co-Planner proposal. The block is the entry; the drawer is its detail.
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const openBlock = openIndex === null ? undefined : blocks[openIndex]
  const drawerEntry: DrawerEntry | null =
    openBlock === undefined
      ? null
      : {
          kind: openBlock.kind,
          title: openBlock.label,
          timeLabel: `${clock(openBlock.start)}–${clock(openBlock.start + openBlock.len)}`,
          color: canvasBlockColor(t, openBlock),
          ...(openBlock.rsvp !== undefined ? { rsvp: openBlock.rsvp } : {}),
          ...(openBlock.ext !== undefined ? { ext: openBlock.ext } : {}),
          ...(openBlock.rec !== undefined ? { rec: openBlock.rec } : {}),
          protected: openBlock.protectedFlag === true,
        }
  const setOpenRsvp = (rsvp: Rsvp): void =>
    setBlocks(bs => bs.map((b, i) => (i === openIndex ? { ...b, rsvp } : b)))
  // Toggle the 🛡 protection flag (design v14 D14) on the open block — communication only;
  // it also counts against the plannable capacity (the head-trace reads `protectedFlag`).
  const setOpenProtected = (next: boolean): void =>
    setBlocks(bs => bs.map((b, i) => (i === openIndex ? { ...b, protectedFlag: next } : b)))
  const removeOpen = (): void => {
    setBlocks(bs => bs.filter((_, i) => i !== openIndex))
    setOpenIndex(null)
  }
  const acceptOpen = (): void => {
    setBlocks(bs => bs.map((b, i) => (i === openIndex ? { ...b, kind: 'actual' } : b)))
    setOpenIndex(null)
  }
  // Make the open block a recurring series (design v17 §F4): persist the rule via the recurrence
  // API from the block's day/time. The occurrence math is the server's deterministic core
  // (ADR-0005); this only shapes the block into a create request. No-ops without an API.
  const makeOpenRecurring = (rule: RecurrenceRule): void => {
    const block = openBlock
    if (block === undefined || apiBaseUrl === null || rule.freq === 'none') return
    const day = weekDays[block.day]
    if (day === undefined) return
    const kind =
      block.kind === 'meeting' ? 'meeting' : block.kind === 'life' ? 'life' : ('focus' as const)
    void createSeries(apiBaseUrl, {
      kind,
      title: block.label,
      anchorDate: localDayKey(day.dateMs),
      startMin: block.start + START_HOUR * 60,
      lenMin: block.len,
      freq: rule.freq,
      endKind: rule.end.kind,
      ...(rule.end.kind === 'until' ? { untilDate: rule.end.date } : {}),
      ...(rule.end.kind === 'count' ? { count: rule.end.count } : {}),
    })
    setOpenIndex(null)
  }

  // Task-Inbox (design v6): assigned tickets; "Plan" drops one into the next free
  // slot as a ghost proposal (deterministic `findFreeSlot` — ADR-0005), never onto a
  // busy slot; a full week says so honestly instead of silently dropping the task.
  const [tasks, setTasks] = useState<readonly InboxTask[]>(INBOX_TASKS)
  const [inboxOpen, setInboxOpen] = useState(true)
  const [inboxNote, setInboxNote] = useState<string | null>(null)
  const doneTask = (task: InboxTask): void => setTasks(ts => ts.filter(x => x.key !== task.key))
  const planTask = (task: InboxTask): void => {
    const lenMin = Math.round(task.est * 60)
    for (let day = 0; day < weekDays.length; day++) {
      const occupied = blocks
        .filter(b => b.day === day)
        .map(b => ({ startMin: b.start, lenMin: b.len }))
      // On today, don't propose a slot that has already elapsed.
      const notBefore = weekDays[day]?.today === true ? NOW_MIN : 0
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
        setInboxNote(`${task.key} scheduled — ${weekDays[day]?.name ?? ''} ${clock(start)}.`)
        return
      }
    }
    setInboxNote(`No free slot in week ${String(week)} — "${task.key}" stays in the inbox.`)
  }

  // "✦ Fill week" (ADR-0063, backlog K2): the Co-Planner distributes the whole inbox
  // across the week's free slots at once — deterministically (`cascadeFreeSlots`,
  // ADR-0005): never past `now`, never over the day window, no collisions. Tasks that
  // fit nowhere stay in the inbox. One undo restores both the blocks and the inbox.
  const [fillUndo, setFillUndo] = useState<{
    readonly blocks: readonly CanvasBlock[]
    readonly tasks: readonly InboxTask[]
  } | null>(null)
  const fillWeek = (): void => {
    if (tasks.length === 0) return
    const occupiedByDay = weekDays.map((_, day) =>
      blocks.filter(b => b.day === day).map(b => ({ startMin: b.start, lenMin: b.len })),
    )
    const notBeforeByDay = weekDays.map(d => (d.today === true ? NOW_MIN : 0))
    const durations = tasks.map(task => Math.round(task.est * 60))
    const placements = cascadeFreeSlots(durations, occupiedByDay, 0, SPAN, notBeforeByDay)
    if (placements.length === 0) {
      setInboxNote(`No free slots in week ${String(week)} — the inbox is unchanged.`)
      return
    }
    const snapshot = { blocks, tasks }
    const newBlocks: CanvasBlock[] = placements.map(p => {
      const task = tasks[p.index]
      const projectId =
        task === undefined ? undefined : (INBOX_PROJECTS[task.project]?.id ?? task.key)
      return {
        day: p.day,
        start: p.startMin,
        len: durations[p.index] ?? 0,
        label: task === undefined ? '' : `${task.key} · ${task.title}`,
        kind: 'ghost' as const,
        ...(projectId !== undefined ? { project: projectId } : {}),
      }
    })
    const placedKeys = new Set(placements.map(p => tasks[p.index]?.key))
    setBlocks(bs => [...bs, ...newBlocks])
    setTasks(ts => ts.filter(task => !placedKeys.has(task.key)))
    setFillUndo(snapshot)
    const left = tasks.length - placements.length
    setInboxNote(
      `Filled ${String(placements.length)} task${placements.length === 1 ? '' : 's'} into free slots as proposals${
        left > 0 ? `, ${String(left)} didn’t fit` : ''
      }.`,
    )
  }
  const undoFill = (): void => {
    if (fillUndo === null) return
    setBlocks(fillUndo.blocks)
    setTasks(fillUndo.tasks)
    setFillUndo(null)
    setInboxNote('Fill undone — blocks and inbox restored.')
  }

  // Yesterday-healing detection (ADR-0064, K3): once, on first open with consent, look
  // for the largest ≥15-min stretch the tracker saw yesterday that was never booked.
  // "Yesterday" = the weekday column left of today, so Adopt lands on a visible day.
  useEffect(() => {
    if (!prefs.autoTracker) return
    const todayIndex = weekDays.findIndex(d => d.today === true)
    if (todayIndex < 1) return // Monday (or off-week) → no visible "yesterday"
    const y = weekDays[todayIndex - 1]
    if (y === undefined) return
    const yKey = localDayKey(y.dateMs)
    if (healSeen(yKey)) return
    const windowStart = y.dateMs + START_HOUR * 3_600_000
    const bookedYesterday = blocks
      .filter(b => b.day === todayIndex - 1 && b.kind === 'actual')
      .map(b => ({
        startMs: windowStart + b.start * 60_000,
        endMs: windowStart + (b.start + b.len) * 60_000,
      }))
    const gap = detectUnbookedGap(loadDaySpans(yKey), bookedYesterday, { minGapMs: 15 * 60_000 })
    if (gap !== null) setHealGap({ gap, dayIndex: todayIndex - 1, dateMs: y.dateMs })
    // First-open detection only — deliberately not re-run when blocks change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.autoTracker])

  const adoptHeal = (): void => {
    if (healGap === null) return
    const windowStart = healGap.dateMs + START_HOUR * 3_600_000
    const startMin = Math.round(Math.max(0, (healGap.gap.startMs - windowStart) / 60_000))
    const endMin = Math.round(Math.min(SPAN, (healGap.gap.endMs - windowStart) / 60_000))
    const snapshot = blocks
    setBlocks(bs => [
      ...bs,
      {
        day: healGap.dayIndex,
        start: startMin,
        len: Math.max(endMin - startMin, 15),
        label: `${healGap.gap.source} · recovered`,
        kind: 'actual',
      },
    ])
    setFillUndo({ blocks: snapshot, tasks }) // reuse the note's Undo to restore
    markHealSeen(localDayKey(healGap.dateMs))
    setInboxNote(
      `Booked ${clock(startMin)}–${clock(endMin)} from yesterday's tracker (${healGap.gap.source}).`,
    )
    setHealGap(null)
  }
  const dismissHeal = (): void => {
    if (healGap !== null) markHealSeen(localDayKey(healGap.dateMs))
    setHealGap(null)
  }

  const [scope, setScope] = useState<'Time' | 'Budgets'>('Time')
  const [ask, setAsk] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)

  const submitAsk = (text: string): void => {
    setAsk(text)
    setAnswer(text.trim() === '' ? null : 'The assistant isn’t connected yet.')
  }

  const scopeChip = (label: 'Time' | 'Budgets'): React.JSX.Element => {
    const active = scope === label
    return (
      <Pressable
        onPress={() => setScope(label)}
        accessibilityRole="button"
        accessibilityLabel={`Context: ${label}`}
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

  // Work / Life / Both filter pills (design v17 §F6.5). Default "Both"; a solo user who
  // never adds a life entry sees the same canvas either way.
  const LAYER_LABEL: Record<PlannerLayer, string> = { both: 'Both', work: 'Work', life: 'Life' }
  const layerChip = (value: PlannerLayer): React.JSX.Element => {
    const active = layer === value
    return (
      <Pressable
        key={value}
        onPress={() => setLayer(value)}
        accessibilityRole="button"
        accessibilityLabel={`Layer: ${LAYER_LABEL[value]}`}
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
          {LAYER_LABEL[value]}
        </Text>
      </Pressable>
    )
  }

  // Only the *shown* blocks are filtered by the layer; the full `blocks` set still
  // feeds capacity and price so the numbers never lie about what exists.
  const shownBlocks = blocks.filter(b => inLayer(b.kind, layer))

  // Recurring-series occurrences for the shown week (design v17 §F4): fetched from the API and
  // placed on the canvas as read-only ↻ ghosts. Empty without an API — the canvas then shows
  // only real blocks. The layer filter applies to them too (a `life` series hides under Work).
  const weekDates = weekDays.map(d => localDayKey(d.dateMs))
  const occurrences = useWeekOccurrences(weekDates).data ?? []
  const recurringBlocks: readonly RecurringBlock[] = occurrencesToBlocks(
    occurrences,
    weekDates,
    START_HOUR,
  ).filter(rb => inLayer(rb.kind, layer))

  return (
    <View style={{ flex: 1 }}>
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
                { value: 'Week', label: 'Week' },
                { value: 'Month', label: 'Month' },
                { value: 'Year', label: 'Year' },
              ]}
              active={view}
              onChange={setView}
            />
          </View>
          {view === 'Week' && (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: t.color.border,
                  borderRadius: t.radius.pill,
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  backgroundColor: t.color.surface,
                }}
              >
                <Text
                  style={{
                    fontSize: t.fontSize.xs,
                    fontWeight: '600',
                    color: t.color.ink,
                    textAlign: 'center',
                  }}
                >
                  This week · KW {week}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize.xs,
                  color: t.color.ink2,
                }}
              >
                <Text style={{ color: t.color.ink, fontWeight: '600' }}>—</Text>
              </Text>
            </>
          )}
          {view === 'Week' && (
            <Button
              size="sm"
              variant={inboxOpen ? 'primary' : 'ghost'}
              onPress={() => setInboxOpen(o => !o)}
            >
              {`Inbox · ${String(tasks.length)}`}
            </Button>
          )}
          {view === 'Week' && tasks.length > 0 && (
            <Button size="sm" variant="ghost" onPress={fillWeek}>
              ✦ Fill week
            </Button>
          )}
          {view === 'Week' && (
            <Button
              size="sm"
              variant={showReality ? 'primary' : 'ghost'}
              onPress={() => {
                if (!prefs.autoTracker) {
                  setInboxNote('Turn on Auto-Tracker in Settings to overlay your reality.')
                  return
                }
                setRealityOn(o => !o)
              }}
            >
              ● Reality
            </Button>
          )}
          {view === 'Week' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s1 }}>
              {PLANNER_LAYERS.map(layerChip)}
            </View>
          )}
          <Button size="sm">
            {view === 'Year' ? 'Plan year' : view === 'Month' ? 'Plan month' : 'Plan week'}
          </Button>
        </View>

        {/* Capacity head-trace (design v14 §F Stufe 2): the week's TRUE plannable capacity —
            the contracted target minus your own life/protected commitments ("KW32 nur 24h"),
            from the deterministic `weekCapacity` core (ADR-0005). Honest by construction: with
            no life blocks it reads the full target, and the sage segment grows as life does. */}
        {view === 'Week' &&
          (() => {
            const cap = weekCapacityFromBlocks(blocks)
            if (cap.targetMs <= 0) return null
            const committedH = cap.committedMs / 3_600_000
            const plannableH = cap.plannableMs / 3_600_000
            const targetH = cap.targetMs / 3_600_000
            const committedPct = Math.round((cap.committedMs / cap.targetMs) * 100)
            return (
              <View style={{ gap: 6, maxWidth: 680 }} accessibilityRole="summary">
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.s2 }}>
                  <Text style={{ fontSize: t.fontSize.xs, fontWeight: '600', color: t.color.ink }}>
                    Plannable this week
                  </Text>
                  <Text
                    style={{
                      fontFamily: t.fontFamily.numeric,
                      fontSize: t.fontSize.xs,
                      color: committedPct > 0 ? t.color.life : t.color.ink2,
                    }}
                    accessibilityLabel={`${plannableH.toFixed(1)} of ${targetH.toFixed(1)} hours plannable, ${committedH.toFixed(1)} hours of life or protected time`}
                  >
                    {`${plannableH.toFixed(1)}h of ${targetH.toFixed(1)}h`}
                    {committedH > 0 ? ` · ${committedH.toFixed(1)}h life/protected` : ''}
                  </Text>
                  <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
                    assuming 8h × 5 days
                  </Text>
                </View>
                {/* Slim two-part bar: sage life/protected, then the plannable remainder. */}
                <View
                  style={{
                    flexDirection: 'row',
                    height: 6,
                    borderRadius: 3,
                    overflow: 'hidden',
                    backgroundColor: t.color.sunk,
                  }}
                >
                  <View style={{ flex: Math.max(0, committedH), backgroundColor: t.color.life }} />
                  <View
                    style={{ flex: Math.max(0, plannableH), backgroundColor: t.color.accent }}
                  />
                </View>
              </View>
            )
          })()}

        {view === 'Month' && (
          <Card>
            <EmptyState
              title="Month view — coming soon"
              hint="The planned load per day across the month appears here once utilization aggregation is live."
            />
          </Card>
        )}

        {view === 'Year' && (
          <Card>
            <EmptyState
              title="Year view — coming soon"
              hint="The weekly intensity across the year appears here once utilization aggregation is live."
            />
          </Card>
        )}

        {view === 'Week' && (
          <>
            {/* AI in context — reachable here, not only in the Assistant tab */}
            <View style={{ gap: t.spacing.s2, maxWidth: 680 }}>
              <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
                {scopeChip('Time')}
                {scopeChip('Budgets')}
              </View>
              <AIAskBar
                value={ask}
                onChange={setAsk}
                onSubmit={() => submitAsk(ask)}
                placeholder="Ask about your week…"
              />
              {answer !== null && <AICallout title="✦ Assistant">{answer}</AICallout>}
            </View>

            {/* Yesterday-healing banner (ADR-0064, K3): a proposal to book a stretch the
                tracker saw yesterday but that was never booked. Adopt/Dismiss, once a day. */}
            {/* Context banner (design v14 §M2): at most ONE banner shows, chosen by the
                deterministic `pickBanner` in the fixed priority Conflict > Price > Healing >
                Note. Each candidate is the same `ContextBanner`, only the variant differs; the
                Price-of-week detail panel below is a separate follow-panel, not a banner. */}
            {(() => {
              const candidates: ContextBannerProps[] = []
              if (healGap !== null) {
                candidates.push({
                  variant: 'healing',
                  title: `Yesterday: ${String(Math.round((healGap.gap.endMs - healGap.gap.startMs) / 60_000))} min unbooked`,
                  body: `The Auto-Tracker saw ${healGap.gap.source} but nothing was booked. Book it?`,
                  actions: [
                    { label: 'Adopt', onPress: adoptHeal },
                    { label: 'Dismiss', onPress: dismissHeal, variant: 'ghost' },
                  ],
                })
              }
              if (inboxNote !== null) {
                candidates.push({
                  variant: 'note',
                  title: inboxNote,
                  leadGlyph: '✦',
                  actions: [
                    ...(fillUndo !== null
                      ? [{ label: 'Undo', onPress: undoFill, variant: 'ghost' as const }]
                      : []),
                    {
                      label: 'OK',
                      onPress: () => {
                        setInboxNote(null)
                        setFillUndo(null)
                      },
                      variant: 'ghost' as const,
                    },
                  ],
                })
              }
              const active = pickBanner(candidates)
              return active === null ? null : <ContextBanner {...active} />
            })()}

            {/* Price of the week (G1): after Fill-week, what this planned week costs across
              intensities — deterministic `priceWeek` over the planned blocks (ADR-0005). */}
            {fillUndo !== null &&
              (() => {
                const prices = priceWeekFromBlocks(blocks)
                if (prices.length === 0) return null
                return (
                  <View
                    style={{
                      gap: t.spacing.s2,
                      paddingVertical: t.spacing.s3,
                      paddingHorizontal: t.spacing.s3,
                      borderRadius: t.radius.block,
                      borderWidth: 1,
                      borderColor: t.color.border,
                      backgroundColor: t.color.surface,
                    }}
                  >
                    <Text
                      style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink }}
                    >
                      Price of the week
                    </Text>
                    <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
                      What this plan costs across intensities · assuming 8h × 5 days
                    </Text>
                    {prices.map(p => (
                      <View
                        key={p.intensity}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}
                      >
                        <Text
                          style={{
                            fontSize: t.fontSize.xs,
                            color: t.color.ink,
                            fontWeight: '600',
                            width: 92,
                            textTransform: 'capitalize',
                          }}
                        >
                          {p.intensity}
                        </Text>
                        <Text
                          style={{
                            fontFamily: t.fontFamily.numeric,
                            fontSize: t.fontSize['2xs'],
                            color: t.color.ink2,
                            flex: 1,
                          }}
                        >
                          {`${String(p.activeDays)}d · ${formatDuration(p.perDayMs)}/day · ${p.freeDays > 0 ? `${String(p.freeDays)} free` : 'no free day'}`}
                        </Text>
                        <Text
                          style={{
                            fontFamily: t.fontFamily.numeric,
                            fontSize: t.fontSize['2xs'],
                            color: p.overtimeMs > 0 ? t.color.warn : t.color.ink3,
                          }}
                        >
                          {p.overtimeMs > 0 ? `+${formatDuration(p.overtimeMs)} OT` : 'on target'}
                        </Text>
                      </View>
                    ))}
                  </View>
                )
              })()}

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
                  <View
                    style={{ flex: 1, flexDirection: 'row' }}
                    onLayout={e => {
                      if (!stacked) {
                        const w = e.nativeEvent.layout.width / weekDays.length
                        if (w > 0) setColWidth(w)
                      }
                    }}
                  >
                    <FlashList
                      data={weekDays}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      estimatedItemSize={stacked ? COL_WIDTH : colWidth}
                      keyExtractor={(day: (typeof weekDays)[0]) => day.name}
                      extraData={{ shownBlocks, recurringBlocks, colWidth, stacked, showReality }}
                      renderItem={({
                        item: day,
                        index: di,
                      }: {
                        item: (typeof weekDays)[0]
                        index: number
                      }) => (
                        <View style={{ width: stacked ? COL_WIDTH : colWidth, height: '100%' }}>
                          <DayColumn
                            day={day}
                            index={di}
                            flex={false}
                            blocks={shownBlocks}
                            recurring={recurringBlocks}
                            colWidth={stacked ? COL_WIDTH : colWidth}
                            onResizeBlock={resizeBlock}
                            onMoveBlock={moveBlock}
                            onOpenBlock={setOpenIndex}
                            showReality={showReality}
                          />
                        </View>
                      )}
                    />
                  </View>
                </View>
              </Card>
              {inboxOpen && <TaskInbox tasks={tasks} onPlan={planTask} onDone={doneTask} />}
            </View>

            <Legend />

            <CoPlannerProposal />

            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3, lineHeight: 18 }}>
              Drag blocks (across days &amp; times) or change their duration at the bottom edge —
              both snap to 15 min. Overlapping blocks share the column (lanes); the &quot;N×&quot;
              chip in the day header counts real conflicts (breaks &amp; FYI don&apos;t count). ↻
              recurring · ⇄ OL = Outlook · ? = tentative · FYI = no attendance. Dashed blocks are
              Co-Planner proposals.
            </Text>
          </>
        )}
      </ScrollView>
      <PlannerEntryDrawer
        entry={drawerEntry}
        onClose={() => setOpenIndex(null)}
        {...(drawerEntry?.kind === 'meeting' ? { onRsvp: setOpenRsvp } : {})}
        {...(drawerEntry?.kind === 'actual' ? { onDelete: removeOpen } : {})}
        {...(drawerEntry?.kind === 'ghost' ? { onAccept: acceptOpen, onDismiss: removeOpen } : {})}
        {...(drawerEntry !== null &&
        (drawerEntry.kind === 'meeting' ||
          drawerEntry.kind === 'actual' ||
          drawerEntry.kind === 'life')
          ? { onProtect: setOpenProtected, onRecurrence: makeOpenRecurring }
          : {})}
      />
    </View>
  )
}
