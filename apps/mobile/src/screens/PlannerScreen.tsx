import { FlashList } from '@shopify/flash-list'
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import {
  assignLanes,
  compressWindow,
  compressedMinAt,
  compressedRect,
  compressedTotalWeight,
  compressedY,
  dropTarget,
  findFreeSlot,
  cascadeFreeSlots,
  formatDuration,
  intervalCoverage,
  maxConcurrency,
  plannerBlockRect,
  plannerBlockState,
  projectColor,
  readableInk,
  snapDurationMin,
  type CompressBand,
  type LanePlacement,
  type PlannerBlockState,
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
import { SeviAdvisory } from '../components/planner/SeviAdvisory'
import { LifeCareCard } from '../components/planner/LifeCareCard'
import { priceWeekFromBlocks } from '../planner/weekPrice'
import { weekCapacityFromBlocks } from '../planner/capacityTrace'
import { inLayer, type PlannerLayer } from '../planner/layer'
import { apiBaseUrl } from '../config'
import { createSeries } from '../api/recurrence'
import { createProject } from '../api/tracking'
import { occurrencesToBlocks, type RecurringBlock } from '../planner/recurring'
import { useWeekOccurrences } from '../hooks/useWeekOccurrences'
import { useMonthOccurrences } from '../hooks/useMonthOccurrences'
import { PlannerCalendar, type TimegridBlock } from '../components/planner/PlannerCalendar'
import {
  PlannerNewEntryDialog,
  type NewEntryDraft,
} from '../components/planner/PlannerNewEntryDialog'
import { useCatalog } from './useCatalog'
import { PlannerLayerChips, type LayerChip } from '../components/planner/PlannerLayerChips'
import { PlanBlockView } from '../components/planner/PlanBlockView'
import { SeviFirstRun } from '../components/planner/SeviFirstRun'
import { useWeekPlans } from '../hooks/useWeekPlans'
import { Text } from '../components/core/Text'
import {
  AICallout,
  AIAskBar,
  Badge,
  Button,
  Card,
  Icon,
  SegmentedControl,
} from '../components/index'
import { TaskInbox } from '../components/planner/TaskInbox'
import { PlannerBacklogRail } from '../components/planner/BacklogRail'
import { PlannerEntryDrawer, type DrawerEntry } from '../components/planner/PlannerEntryDrawer'
import { PlannerStartPicker } from '../components/planner/PlannerStartPicker'
import { PlannerDayTracker } from '../components/planner/PlannerDayTracker'
import { PlannerDayList, type DayListItem } from '../components/planner/PlannerDayList'
import { PlannerDayInstruments } from '../components/planner/PlannerDayInstruments'
import { DayRepairSheet } from '../components/planner/DayRepairSheet'
import { useDayRepair } from '../hooks/useDayRepair'
import { useToast } from '../components/core/Toast'
import { useAbsences } from '../hooks/useAbsences'
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

// ---- Canvas geometry: 08:00–22:00, minutes from the top of the window ----
// The window runs to 22:00 (design v20) so the evening zone (18–22) is visible; blocks store
// absolute minutes-from-08:00, so widening the window only rescales pixels, never the data.
const START_HOUR = 8
const END_HOUR = 22
const SPAN = (END_HOUR - START_HOUR) * 60
const BODY_HEIGHT = 616 // ~44 px per hour × 14 h
/** A readable floor for a plan block (issue #341): a short block never squashes to a
 *  sliver — title + time still fit even when compression maps it small. */
const MIN_PLAN_BLOCK_PX = 34
/** Minutes-from-08:00 of the contracted day end (18:00) — the evening-zone / soll-end line. */
const SOLL_END_MIN = (18 - START_HOUR) * 60
const HEADER_HEIGHT = 46
const GUTTER = 52
const COL_WIDTH = 150
const STACK_BREAKPOINT = 860
/** "Now" — the real current time, in minutes from 08:00, clamped to the window. */
const NOW = new Date()
const NOW_MIN = Math.max(0, Math.min((NOW.getHours() - START_HOUR) * 60 + NOW.getMinutes(), SPAN))
/** Minute-of-day offset of the canvas's stored block base (blocks store minutes from 08:00). */
const BASE_MIN = START_HOUR * 60
/** "Now" as an absolute minute of day — the compressed mapping works in day minutes. */
const NOW_ABS = NOW.getHours() * 60 + NOW.getMinutes()

type CanvasKind = 'actual' | 'meeting' | 'ghost' | 'break' | 'life' | 'travel'
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
  /** Travel route (design v20 §G4) — the trip's From/To; distance is user-entered km, never inferred. */
  readonly routeFrom?: string
  readonly routeTo?: string
  readonly distanceKm?: number | null
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
/** The visible Mon–Sun week, shifted by `offsetWeeks` (0 = this week; ± for KW navigation). Only
 *  the real current day is flagged `today`, so an off-current week shows no "now" line. */
function buildWeek(offsetWeeks = 0): readonly DemoDay[] {
  const now = new Date()
  const monday = new Date(now)
  const daysSinceMonday = (now.getDay() + 6) % 7
  monday.setDate(now.getDate() - daysSinceMonday + offsetWeeks * 7)
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

/** day 0–4 · start/len in minutes from 08:00 · kind + project id for the color. */
const DEMO_BLOCKS: readonly CanvasBlock[] = []

/** A human label for an entry kind — the day list's type caption (design v13 §K, REQ-040). */
function canvasKindLabel(kind: string): string {
  if (kind === 'meeting') return 'Meeting'
  if (kind === 'ghost') return 'Proposed'
  if (kind === 'break') return 'Break'
  if (kind === 'life') return 'Life'
  if (kind === 'travel') return 'Travel'
  return 'Booked time'
}

function canvasBlockColor(
  t: Theme,
  b: { readonly kind: string; readonly project?: string },
): string {
  // Life blocks (design v14 §F) wear the sage `--life` token — family is not a project, so it
  // never borrows a project color. Its time reduces the plannable capacity (the head-trace).
  if (b.kind === 'life') return t.color.life
  // Travel (design v20 §G4): a distinct in-transit tone, never a project fill.
  if (b.kind === 'travel') return t.color.warn
  if (b.kind === 'break' || b.project === undefined) return t.color.ink3
  return projectColor(b.project, t.mode)
}

/** Clock label for a minute offset from 08:00. */
function clock(minFromStart: number): string {
  const m = START_HOUR * 60 + minFromStart
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(Math.floor(m / 60))}:${p(m % 60)}`
}

/** Clock label for an absolute minute of day (plan blocks store day minutes). */
function clockAbs(minOfDay: number): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(Math.floor(minOfDay / 60))}:${p(minOfDay % 60)}`
}

/**
 * An accepted-plan block on the canvas (ADR-0072 D3): the calm default layer.
 * Absolute day minutes (the seam's shape), a derived four-way state and the
 * project/kind colour it wears as a bold fill (issue #341). Read-only — plan
 * mutations flow through the plan-apply seam only (ADR-0071).
 */
interface PlanCanvasBlock {
  readonly day: number
  readonly startMin: number
  readonly lenMin: number
  readonly label: string
  readonly state: PlannerBlockState
  readonly fillColor: string
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
  bands,
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
  /** The week's compressed bands (issue #341) — the shared minutes→pixels mapping. */
  readonly bands: readonly CompressBand[]
}): React.JSX.Element {
  const t = useTheme()
  const [hovered, setHovered] = useState(false)
  const rect = compressedRect(bands, BASE_MIN + block.start, block.len)
  // Drag/resize map pixels↔minutes linearly — exact inside the expanded band, where
  // every editable block lives (the compressed strips hold no editable content).
  const minPerPx = compressedTotalWeight(bands) / BODY_HEIGHT
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
        minPerPx,
        dayCount: 5, // Defaulting to 5 for now since weekDays is length 5
        spanMin: SPAN,
      },
    )
    if (day !== block.day || startMin !== block.start) {
      onMove?.(day, startMin)
    }
  }

  const handleResize = (dy: number) => {
    const deltaMin = dy * minPerPx
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
          { colWidth, minPerPx, dayCount: 5, spanMin: SPAN },
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

  // Block redesign (issue #341, owner-revised): the project colour is the block's
  // BOLD FILL — "Farbe knallt, Ruhe kommt aus Layern" (calm comes from the layer
  // chips + edge-hour compression, not from draining the colour). Strict type
  // hierarchy (title > time > meta); text ink is the luminance-readable choice on
  // the fill so contrast holds. Ghosts stay outline (a proposal), breaks/FYI sit on
  // a quiet sunk fill.
  const filled = block.kind === 'actual' || solidMeeting
  const fillInk = readableInk(color)
  const labelColor = filled
    ? fillInk
    : fyi
      ? t.color.ink3
      : isGhost || tentative
        ? color
        : isBreak
          ? t.color.ink3
          : t.color.ink
  const timeColor = filled ? fillInk : isGhost ? color : t.color.ink2
  const badgeColor = labelColor

  const baseBg = filled ? color : isBreak || fyi ? t.color.sunk : 'transparent'
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
          // The fill carries the colour; only non-filled kinds wear an outline —
          // ghosts (dashed proposal), breaks (dashed), tentative/FYI meetings.
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
                    // Type hierarchy (issue #341): the title leads — heavier and larger
                    // than the time line, which in turn outranks the meta badges.
                    fontSize: isBreak ? t.fontSize['2xs'] : t.fontSize.xs,
                    fontWeight: isBreak ? '600' : '700',
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

/** Whole hours inside the expanded (non-compressed) bands — the visible hour grid. */
function expandedHours(bands: readonly CompressBand[]): number[] {
  const hours: number[] = []
  for (const band of bands) {
    if (band.compressed) continue
    const from = Math.ceil(band.startMin / 60)
    const to = Math.floor(band.endMin / 60)
    for (let h = from; h <= to; h++) {
      if (!hours.includes(h)) hours.push(h)
    }
  }
  return hours
}

/**
 * The left time gutter — hour labels aligned to the compressed day-body grid
 * (issue #341): expanded hours read as labels; a collapsed edge band reads as a
 * tiny `0–7` range, so the swallowed hours stay honest, just quiet.
 */
function HourGutter({ bands }: { readonly bands: readonly CompressBand[] }): React.JSX.Element {
  const t = useTheme()
  const hours = expandedHours(bands)
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
              top: compressedY(bands, h * 60) * BODY_HEIGHT - 7,
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize['2xs'],
              color: t.color.ink3,
            }}
          >
            {String(h).padStart(2, '0')}:00
          </Text>
        ))}
        {bands
          .filter(b => b.compressed)
          .map(b => (
            <Text
              key={`comp-${String(b.startMin)}`}
              accessibilityLabel={`Collapsed hours ${String(Math.floor(b.startMin / 60))}–${String(Math.ceil(b.endMin / 60))}`}
              style={{
                position: 'absolute',
                right: 8,
                top:
                  ((compressedY(bands, b.startMin) + compressedY(bands, b.endMin)) / 2) *
                    BODY_HEIGHT -
                  6,
                fontFamily: t.fontFamily.numeric,
                fontSize: 8,
                color: t.color.ink3,
              }}
            >
              {`${String(Math.floor(b.startMin / 60))}–${String(Math.ceil(b.endMin / 60))}`}
            </Text>
          ))}
      </View>
    </View>
  )
}

/** How the auto-tracker's reality maps onto one day column (ADR-0064, K1). */
interface DayRealityView {
  /** Active spans as absolute-minute day ranges — positioned via the compressed bands. */
  readonly segments: readonly { readonly startMin: number; readonly endMin: number }[]
  /** Signed drift vs the day's booked time (tracked − booked), in ms. */
  readonly driftMs: number
}

/**
 * Build a day's reality overlay from its captured spans + booked (actual) blocks. Pure:
 * active spans (idle/away excluded) become minute ranges of the day (the compressed
 * band mapping places them), and the deterministic `realityDrift` gives the day-head
 * chip's signed delta.
 */
function dayRealityView(
  spans: readonly TimedSpan[],
  dayBlocks: readonly CanvasBlock[],
  dayMidnightMs: number,
): DayRealityView {
  const segments: { startMin: number; endMin: number }[] = []
  for (const s of spans) {
    if (s.source === 'Idle' || s.source === 'Away') continue
    const startMin = Math.max(0, (s.startMs - dayMidnightMs) / 60_000)
    const endMin = Math.min(24 * 60, (s.endMs - dayMidnightMs) / 60_000)
    if (endMin <= startMin) continue
    segments.push({ startMin, endMin })
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
  planBlocks,
  recurring,
  bands,
  colWidth,
  onResizeBlock,
  onMoveBlock,
  onOpenBlock,
  showReality,
  onCreateAt,
  eveningZone,
  nonWorking,
}: {
  readonly day: DemoDay
  readonly index: number
  readonly flex: boolean
  readonly blocks: readonly CanvasBlock[]
  /** The accepted plan's blocks for the week (ADR-0072 D3) — the calm default layer. */
  readonly planBlocks: readonly PlanCanvasBlock[]
  /** The week's compressed bands (issue #341) — the shared minutes→pixels mapping. */
  readonly bands: readonly CompressBand[]
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
  /** Tap an empty slot to create a 1 h block at the snapped start (design v20). Optional so the
   *  week canvas is unchanged unless a caller opts in. */
  readonly onCreateAt?: (startMin: number) => void
  /** Shade the evening zone (18–22) and draw the soll-end line at 18:00 (design v20 Day stage). */
  readonly eveningZone?: boolean
  /** Mark the column as a non-working day (hatch + pill, no tap-to-create) — design v20. */
  readonly nonWorking?: boolean
}): React.JSX.Element {
  const t = useTheme()
  const hours = expandedHours(bands)
  // Keep each block's index in the shared list so a resize maps back to it.
  const dayEntries = blocks
    .map((b, globalIndex) => ({ b, globalIndex }))
    .filter(x => x.b.day === index)
  const dayBlocks = dayEntries.map(x => x.b)
  // The accepted plan's blocks for this day (ADR-0072 D3) — the calm default layer.
  const dayPlan = planBlocks.filter(pb => pb.day === index)
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
    ? dayRealityView(loadDaySpans(localDayKey(day.dateMs)), dayBlocks, day.dateMs)
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
        {/* Empty-slot tap-to-create (design v20): a tap on open canvas creates a 1 h block at the
            snapped time. Rendered first so the blocks below catch their own taps; only present when
            a caller wires `onCreateAt`. */}
        {onCreateAt && !nonWorking && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add an entry at the tapped time"
            onPress={e => {
              // Invert the compressed mapping: touch fraction → absolute minute →
              // the canvas's stored 08:00 base, snapped to the half hour.
              const abs = compressedMinAt(bands, e.nativeEvent.locationY / BODY_HEIGHT)
              const raw = abs - BASE_MIN
              const snapped = Math.max(0, Math.min(Math.round(raw / 30) * 30, SPAN - 30))
              onCreateAt(snapped)
            }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        )}
        {hours.map(h => (
          <View
            key={h}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: compressedY(bands, h * 60) * BODY_HEIGHT,
              borderTopWidth: 1,
              borderTopColor: t.color.border,
              opacity: 0.55,
            }}
          />
        ))}
        {/* 30-min dotted hairlines — a finer grid for the 15-min snapping (design v6). */}
        {hours.map(h => (
          <View
            key={`half-${String(h)}`}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: compressedY(bands, h * 60 + 30) * BODY_HEIGHT,
              borderTopWidth: 1,
              borderTopColor: t.color.border,
              borderStyle: 'dotted',
              opacity: 0.25,
            }}
          />
        ))}
        {/* Zeit-Kompression (issue #341): each collapsed edge band reads as a thin
            hatched strip — the swallowed hours stay visible as a band, never lied away. */}
        {bands
          .filter(b => b.compressed)
          .map(b => (
            <View
              key={`strip-${String(b.startMin)}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: compressedY(bands, b.startMin) * BODY_HEIGHT,
                height: Math.max(
                  (compressedY(bands, b.endMin) - compressedY(bands, b.startMin)) * BODY_HEIGHT,
                  2,
                ),
                backgroundColor: t.color.sunk,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: t.color.border,
                opacity: 0.8,
              }}
            />
          ))}
        {/* Evening zone (design v20): the hours past the contracted day end (18:00) read muted,
            with a dashed soll-end line at 18:00 — a glanceable "after hours" cue. Client-side,
            pointer-transparent so it never blocks taps or drags. */}
        {eveningZone && (
          <>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: compressedY(bands, BASE_MIN + SOLL_END_MIN) * BODY_HEIGHT,
                bottom: 0,
                backgroundColor: t.color.ink,
                opacity: 0.05,
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: compressedY(bands, BASE_MIN + SOLL_END_MIN) * BODY_HEIGHT,
                borderTopWidth: 1.5,
                borderTopColor: t.color.ink3,
                borderStyle: 'dashed',
                opacity: 0.6,
              }}
            />
          </>
        )}
        {/* Non-working day (design v20): a muted overlay + centered pill; no plan surface, no
            tap-to-create. Deterministic from the weekday (Sat/Sun by default), never fabricated. */}
        {nonWorking && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: t.color.ink,
              opacity: 0.06,
            }}
          >
            <Text
              style={{
                fontSize: t.fontSize['2xs'],
                fontWeight: '700',
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: t.color.ink2,
              }}
            >
              Non-working day
            </Text>
          </View>
        )}
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
              top: compressedY(bands, seg.startMin) * BODY_HEIGHT + 1,
              height: Math.max(
                (compressedY(bands, seg.endMin) - compressedY(bands, seg.startMin)) * BODY_HEIGHT,
                2,
              ),
              backgroundColor: t.color.ink3,
              opacity: 0.7,
            }}
          />
        ))}
        {/* The accepted plan (ADR-0072 D3): the calm default layer — redesigned blocks
            with the four states, read-only; mutations only ever flow through the seam. */}
        {dayPlan.map((pb, i) => (
          <PlanBlockView
            key={`plan-${String(pb.startMin)}-${String(i)}`}
            label={pb.label}
            timeLabel={`${clockAbs(pb.startMin)}–${clockAbs(pb.startMin + pb.lenMin)}`}
            state={pb.state}
            fillColor={pb.fillColor}
            top={compressedY(bands, pb.startMin) * BODY_HEIGHT}
            height={Math.max(
              (compressedY(bands, pb.startMin + pb.lenMin) - compressedY(bands, pb.startMin)) *
                BODY_HEIGHT,
              MIN_PLAN_BLOCK_PX,
            )}
          />
        ))}
        {dayEntries.map(({ b, globalIndex }, i) => (
          <CanvasBlockView
            key={`${b.label}-${String(i)}`}
            block={b}
            placement={placements[i] ?? { lane: 0, lanes: 1 }}
            colWidth={colWidth}
            bands={bands}
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
              top: compressedY(bands, BASE_MIN + rb.start) * BODY_HEIGHT + 1,
              height: Math.max(
                (compressedY(bands, BASE_MIN + rb.start + rb.len) -
                  compressedY(bands, BASE_MIN + rb.start)) *
                  BODY_HEIGHT -
                  2,
                12,
              ),
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
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: compressedY(bands, NOW_ABS) * BODY_HEIGHT,
            }}
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
      {/* Block redesign (issue #341, owner-revised): the project colour FILLS the
          block — the legend teaches exactly what the canvas renders. */}
      <Item
        label="Booked"
        swatch={
          <View style={{ width: 16, height: 11, borderRadius: 3, backgroundColor: sample }} />
        }
      />
      <Item
        label="Meeting"
        swatch={
          <View style={{ width: 16, height: 11, borderRadius: 3, backgroundColor: meeting }} />
        }
      />
      <Item
        label="Missed"
        swatch={
          <View
            style={{
              width: 16,
              height: 11,
              borderRadius: 3,
              backgroundColor: sample,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: readableInk(sample),
            }}
          />
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
  // KW navigation (design v20): the header's ‹ › shift the visible week; 0 = this week. The whole
  // canvas + the occurrence queries re-key off `weekDays`, so nothing else needs to know the offset.
  const [weekOffset, setWeekOffset] = useState(0)
  const weekDays = useMemo(() => buildWeek(weekOffset), [weekOffset])
  const week = isoWeek(new Date(weekDays[0]?.dateMs ?? Date.now()))
  // The Planner opens on the **Day** stage (design v20: "Today" is the day view of the calendar);
  // Week/Month/Year zoom out from it. Today stays its own route too — this only adds the Day zoom.
  const [view, setView] = useState<'Day' | 'Week' | 'Month' | 'Year'>('Day')
  // Canvas ⇄ List (design v13 §K, REQ-040): the Day view can drop the geometry for a flat,
  // screen-reader-friendly list of the same entries. Canvas stays the default.
  const [dayMode, setDayMode] = useState<'canvas' | 'list'>('canvas')
  // The week canvas blocks are local, resizable state (design v6 A1) — dragging a
  // block's bottom edge commits a new 15-min-snapped duration. Demo data for now.
  const [blocks, setBlocks] = useState<readonly CanvasBlock[]>(DEMO_BLOCKS)
  // Ruhe als Default (ADR-0072 D3, REQ-074, ux-vision §2.7): the canvas shows only the
  // accepted plan + the now-line. Every additional layer — reality trace, proposal
  // ghosts, life shades, the capacity head-trace — sits behind a layer chip, one
  // explicit tap away, and each chip's state persists per user via the preferences
  // contract (append-only keys). The old Work/Life/Both filter collapses into the
  // Life chip: life is shown only when its layer is open.
  const { prefs, setPref } = usePreferences()
  const layer: PlannerLayer = prefs.plannerLayerLife ? 'both' : 'work'
  const ghostsOn = prefs.plannerLayerGhosts
  // Reality layer (ADR-0064, K1): gated on the `autoTracker` consent — with it off
  // there is nothing to show, so the chip guides to Settings instead of lying.
  const realityOn = prefs.plannerLayerReality
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
  // The Day view renders a single full-width column; its measured width drives the same
  // drag mapping the week uses (design v20 Day stage).
  const [dayColW, setDayColW] = useState(COL_WIDTH)
  // One-tap day repair (ADR-0072 D1, REQ-072): the drift chip is the handle on the Day view —
  // the sheet renders its own `Plan gerissen · Reparieren` chip when the pure core has a
  // repair to offer, and nothing at all otherwise.
  const dayRepair = useDayRepair(usePlanner())
  const toast = useToast()
  // Empty-slot tap-to-create (design v20): drop a 1 h actual block at the tapped, snapped time on
  // the given day; a transient toast confirms it. Clamped inside the 08–18 window.
  const createBlockAt = (day: number, startMin: number): void => {
    const start = Math.max(0, Math.min(startMin, SPAN - 60))
    setBlocks(bs => [...bs, { day, start, len: 60, label: 'New entry', kind: 'actual' }])
    toast.show(`Entry created — ${clock(start)}–${clock(start + 60)}.`)
  }
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
          ...(openBlock.routeFrom !== undefined ? { routeFrom: openBlock.routeFrom } : {}),
          ...(openBlock.routeTo !== undefined ? { routeTo: openBlock.routeTo } : {}),
          ...(openBlock.distanceKm !== undefined ? { distanceKm: openBlock.distanceKm } : {}),
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
  // ±15-min nudge (design v20 drawer): shift the open block's start, clamped inside the window.
  const nudgeOpen = (deltaMin: number): void => {
    setBlocks(bs =>
      bs.map((b, i) =>
        i === openIndex
          ? { ...b, start: Math.max(0, Math.min(b.start + deltaMin, SPAN - b.len)) }
          : b,
      ),
    )
  }
  // Duplicate (design v20 drawer): append a copy right after the open block, clamped; the lane
  // model shows both. A toast confirms.
  const duplicateOpen = (): void => {
    const b = openBlock
    if (b === undefined) return
    const start = Math.min(b.start + b.len, SPAN - b.len)
    setBlocks(bs => [...bs, { ...b, start }])
    setOpenIndex(null)
    toast.show('Entry duplicated.')
  }
  const acceptOpen = (): void => {
    setBlocks(bs => bs.map((b, i) => (i === openIndex ? { ...b, kind: 'actual' } : b)))
    setOpenIndex(null)
  }
  // Save the travel route (design v20 §G4): store From/To/km on the open block and, when both ends
  // are named, title it `From → To`. The km is exactly what the user typed — nothing is inferred
  // (ADR-0005). A toast confirms; the drawer stays open so the route reads back.
  const saveTravelDetail = (detail: { from: string; to: string; km: number | null }): void => {
    setBlocks(bs =>
      bs.map((b, i) =>
        i === openIndex
          ? {
              ...b,
              routeFrom: detail.from,
              routeTo: detail.to,
              distanceKm: detail.km,
              label:
                detail.from.length > 0 && detail.to.length > 0
                  ? `${detail.from} → ${detail.to}`
                  : b.label,
            }
          : b,
      ),
    )
    toast.show('Route saved.')
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

  // Only the *shown* blocks are filtered by the layers; the full `blocks` set still
  // feeds capacity and price so the numbers never lie about what exists. Proposal
  // ghosts are a chip layer (calm default, issue #341) — hidden until opened.
  const shownBlocks = blocks.filter(b => inLayer(b.kind, layer) && (ghostsOn || b.kind !== 'ghost'))

  // Recurring-series occurrences for the shown week (design v17 §F4): fetched from the API and
  // placed on the canvas as read-only ↻ ghosts. Empty without an API — the canvas then shows
  // only real blocks. The layer filter applies to them too (a `life` series hides under Work).
  const weekDates = weekDays.map(d => localDayKey(d.dateMs))
  const weekOccResource = useWeekOccurrences(weekDates)
  const occurrences = weekOccResource.data ?? []
  const recurringBlocks: readonly RecurringBlock[] = occurrencesToBlocks(
    occurrences,
    weekDates,
    START_HOUR,
  ).filter(rb => inLayer(rb.kind, layer))

  // The accepted plan of the shown week (ADR-0072 D3): the calm canvas's default
  // layer. Each block derives its four-way state deterministically from the clock
  // and — when the auto-tracker may observe — the reality coverage; `missed` is
  // exactly what the one-tap repair (#339) consumes. Read-only on the canvas.
  const weekPlans = useWeekPlans(weekDates)
  const todayMidnightKey = localDayKey(NOW.getTime())
  const planCanvasBlocks: readonly PlanCanvasBlock[] = (weekPlans.data ?? []).flatMap(
    (plan, dayIndex) => {
      if (plan === null) return []
      const dayKey = weekDates[dayIndex] ?? ''
      // The clock relative to this column: fully past days read 1440, future days −1.
      const dayNowMin =
        dayKey === todayMidnightKey ? NOW_ABS : dayKey < todayMidnightKey ? 1440 : -1
      const observed = prefs.autoTracker
        ? loadDaySpans(dayKey)
            .filter(s => s.source !== 'Idle' && s.source !== 'Away')
            .map(s => {
              const dayMs = weekDays[dayIndex]?.dateMs ?? 0
              const startMin = Math.max(0, (s.startMs - dayMs) / 60_000)
              const endMin = Math.min(1440, (s.endMs - dayMs) / 60_000)
              return { startMin, lenMin: Math.max(0, endMin - startMin) }
            })
        : null
      return plan.blocks.map(b => ({
        day: dayIndex,
        startMin: b.startMin,
        lenMin: b.lenMin,
        label: b.kind === 'break' ? 'Pause' : b.label,
        state: plannerBlockState(
          b.startMin,
          b.lenMin,
          dayNowMin,
          observed === null ? null : intervalCoverage(b.startMin, b.lenMin, observed),
        ),
        fillColor:
          b.kind === 'meeting'
            ? t.color.accent
            : b.kind === 'break'
              ? t.color.sunk
              : projectColor(b.taskId ?? b.label, t.mode),
      }))
    },
  )

  // Zeit-Kompression (issue #341): ONE deterministic band partition for the whole
  // visible week, from everything the canvas may show — so all seven columns (and
  // the web timegrid) share the same minutes→pixels mapping. Empty edge hours
  // (≈0–7 / 20–24) collapse to thin strips; any block keeps its whole hour visible.
  const bands = compressWindow(
    [
      ...shownBlocks.map(b => ({ startMin: BASE_MIN + b.start, lenMin: b.len })),
      ...recurringBlocks.map(rb => ({ startMin: BASE_MIN + rb.start, lenMin: rb.len })),
      ...planCanvasBlocks.map(pb => ({ startMin: pb.startMin, lenMin: pb.lenMin })),
    ],
    0,
    24 * 60,
  )
  // The expanded (lived) band — the web timegrid's visible window (ADR-0068).
  const expandedBand = bands.find(b => !b.compressed)

  // The layer chips (issue #341): one tap opens a layer, the tap persists per user.
  // The backlog rail (#340) claims the reserved Backlog slot as its own self-contained
  // closed-by-default pill rendered just below this row (see `PlannerBacklogRail`), not as
  // an entry here — it owns its feeds, packWeek run and read-back, so it stays one control.
  const layerChips: readonly LayerChip[] = [
    {
      key: 'reality',
      label: 'Reality',
      glyph: '●',
      active: realityOn,
      onToggle: () => {
        if (!realityOn && !prefs.autoTracker) {
          setInboxNote('Turn on Auto-Tracker in Settings to overlay your reality.')
          return
        }
        setPref('plannerLayerReality', !realityOn)
      },
    },
    {
      key: 'ghosts',
      label: 'Ghosts',
      glyph: '◇',
      active: ghostsOn,
      onToggle: () => setPref('plannerLayerGhosts', !ghostsOn),
    },
    {
      key: 'life',
      label: 'Life',
      active: prefs.plannerLayerLife,
      onToggle: () => setPref('plannerLayerLife', !prefs.plannerLayerLife),
    },
    {
      key: 'capacity',
      label: 'Capacity',
      active: prefs.plannerLayerCapacity,
      onToggle: () => setPref('plannerLayerCapacity', !prefs.plannerLayerCapacity),
    },
  ]

  // Sevi first run (REQ-074): a truly empty planner — no local blocks, no
  // occurrences, no accepted plan in the visible week, everything loaded — is
  // Sevi's stage, exactly once. Zero demo data; the flag persists like any pref.
  const hasAcceptedPlan = (weekPlans.data ?? []).some(p => p !== null && p.blocks.length > 0)
  const showFirstRun =
    apiBaseUrl !== null &&
    !prefs.plannerFirstRunDone &&
    blocks.length === 0 &&
    occurrences.length === 0 &&
    !hasAcceptedPlan &&
    !weekOccResource.loading &&
    !weekPlans.loading

  // Web timegrid (design v20 §Cal, ADR-0068): on web the Week/Day grid is FullCalendar's editable
  // timegrid; native keeps the RN `DayColumn` canvas. The same local blocks feed both — mapped here
  // to the timegrid's shape, with each block's index so a drag/resize maps back to `moveBlock`/
  // `resizeBlock` exactly as the RN canvas does. `weekStartMs` is the shown week's Monday midnight.
  const webTimegrid = Platform.OS === 'web'
  const weekStartMs = weekDays[0]?.dateMs
  const timegridBlocks: readonly TimegridBlock[] = shownBlocks.map((b, index) => ({
    index,
    day: b.day,
    startMin: b.start,
    lenMin: b.len,
    label: b.label,
    color: canvasBlockColor(t, b),
    kind: b.kind,
  }))

  // Month/Year (Kalender) views (design v18 PlannerViews): the shown month/year is the real
  // current one; occurrences over the whole window are fetched (empty without an API → honest
  // empty calendar) and shaped by the pure `buildMonthDays`/`buildYearMonths`. The daily target
  // seeds the day-load bar. Events (holidays/absences) are wired in a later slice — none for now.
  const calNow = new Date()
  const calYear = calNow.getFullYear()
  const calMonth0 = calNow.getMonth()
  const calToday = calNow.getDate()
  const pad2 = (n: number): string => String(n).padStart(2, '0')
  const monthDim = new Date(calYear, calMonth0 + 1, 0).getDate()
  const calFrom =
    view === 'Month'
      ? `${String(calYear)}-${pad2(calMonth0 + 1)}-01`
      : view === 'Year'
        ? `${String(calYear)}-01-01`
        : ''
  const calTo =
    view === 'Month'
      ? `${String(calYear)}-${pad2(calMonth0 + 1)}-${pad2(monthDim)}`
      : view === 'Year'
        ? `${String(calYear)}-12-31`
        : ''
  const monthOccResource = useMonthOccurrences(calFrom, calTo)
  const calOccurrences = monthOccResource.data ?? []
  const shownCalOccurrences = calOccurrences.filter(o => inLayer(o.kind, layer))
  const DAILY_TARGET_HOURS = 8.33

  // New-Entry dialog (design v19): create a real Task or Life entry by hand. Projects come live
  // from the workspace catalog; a new entry persists as a recurring series (a single occurrence)
  // placed at the next free slot, then the week + calendar reload. Nothing is invented (ADR-0005);
  // without an API the create is a no-op and the dialog says so, rather than faking a row.
  const catalog = useCatalog()
  const absences = useAbsences()
  const dialogProjects = (catalog.data ?? [])
    .flatMap(c => c.projects)
    .map(p => ({ id: p.id, name: p.name }))
  const [newEntryOpen, setNewEntryOpen] = useState(false)
  const [creatingEntry, setCreatingEntry] = useState(false)

  const submitNewEntry = (draft: NewEntryDraft): void => {
    const lenMin = Math.round(draft.estHours * 60)
    // Prefer today; otherwise the first day of the shown week with a free slot.
    const todayIdx = weekDays.findIndex(d => d.today === true)
    const dayOrder =
      todayIdx >= 0
        ? [todayIdx, ...weekDays.map((_, i) => i).filter(i => i !== todayIdx)]
        : weekDays.map((_, i) => i)
    let placedDay: number | null = null
    let placedStart: number | null = null
    for (const day of dayOrder) {
      const occupied = blocks
        .filter(b => b.day === day)
        .map(b => ({ startMin: b.start, lenMin: b.len }))
      const notBefore = weekDays[day]?.today === true ? NOW_MIN : 0
      const start = findFreeSlot(occupied, lenMin, 0, SPAN, notBefore)
      if (start !== null) {
        placedDay = day
        placedStart = start
        break
      }
    }
    if (placedDay === null || placedStart === null) {
      setInboxNote(`No free slot in week ${String(week)} — "${draft.title}" was not created.`)
      setNewEntryOpen(false)
      return
    }
    const dayIdx = placedDay
    const startMin = placedStart
    const dayInfo = weekDays[dayIdx]
    if (dayInfo === undefined) {
      setNewEntryOpen(false)
      return
    }
    if (apiBaseUrl === null) {
      // No backend configured: reflect the entry locally so the user still sees it, and say
      // plainly it is not persisted (honest states — never fake a saved row).
      setBlocks(bs => [
        ...bs,
        {
          day: dayIdx,
          start: startMin,
          len: lenMin,
          label: draft.title,
          kind: draft.isLife
            ? 'life'
            : draft.seriesKind === 'meeting'
              ? 'meeting'
              : draft.seriesKind === 'travel'
                ? 'travel'
                : 'ghost',
          ...(draft.isLife || draft.projectId === null ? {} : { project: draft.projectId }),
        },
      ])
      setInboxNote(`"${draft.title}" added to this week (local only — connect a backend to save).`)
      setNewEntryOpen(false)
      return
    }
    setCreatingEntry(true)
    void createSeries(apiBaseUrl, {
      kind: draft.seriesKind,
      title: draft.title,
      anchorDate: localDayKey(dayInfo.dateMs),
      startMin: startMin + START_HOUR * 60,
      lenMin,
      freq: 'weekly',
      endKind: 'count',
      count: 1,
      ...(draft.isLife || draft.projectId === null ? {} : { projectId: draft.projectId }),
      ...(draft.isLife ? {} : { priority: draft.priority }),
      ...(draft.description === '' ? {} : { note: draft.description }),
    })
      .then(() => {
        weekOccResource.reload()
        monthOccResource.reload()
        setInboxNote(`"${draft.title}" created — ${dayInfo.name} ${clock(startMin)}.`)
      })
      .catch(() => setInboxNote(`Could not create "${draft.title}" — please try again.`))
      .finally(() => {
        setCreatingEntry(false)
        setNewEntryOpen(false)
      })
  }

  const createDialogProject = (name: string): void => {
    if (apiBaseUrl === null) {
      setInboxNote('Connect a backend to add projects.')
      return
    }
    void createProject(apiBaseUrl, { name })
      .then(() => catalog.reload())
      .catch(() => setInboxNote(`Could not add project "${name}".`))
  }

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
                { value: 'Day', label: 'Day' },
                { value: 'Week', label: 'Week' },
                { value: 'Month', label: 'Month' },
                { value: 'Year', label: 'Year' },
              ]}
              active={view}
              onChange={setView}
            />
          </View>
          {(view === 'Week' || view === 'Day') && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: t.color.border,
                borderRadius: t.radius.pill,
                backgroundColor: t.color.surface,
              }}
            >
              {/* KW ‹ › navigation (design v20): step the visible week; a middle tap returns to now. */}
              <Pressable
                onPress={() => setWeekOffset(o => o - 1)}
                accessibilityRole="button"
                accessibilityLabel="Previous week"
                style={{ paddingVertical: 6, paddingHorizontal: 12 }}
              >
                <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>‹</Text>
              </Pressable>
              <Pressable
                onPress={() => setWeekOffset(0)}
                accessibilityRole="button"
                accessibilityLabel="This week"
                disabled={weekOffset === 0}
              >
                <Text style={{ fontSize: t.fontSize.xs, fontWeight: '600', color: t.color.ink }}>
                  {weekOffset === 0 ? `This week · KW ${String(week)}` : `KW ${String(week)}`}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setWeekOffset(o => o + 1)}
                accessibilityRole="button"
                accessibilityLabel="Next week"
                style={{ paddingVertical: 6, paddingHorizontal: 12 }}
              >
                <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>›</Text>
              </Pressable>
            </View>
          )}
          {/* New-Entry dialog trigger (design v19) — create a Task or Life entry by hand. */}
          <Button size="sm" variant="primary" onPress={() => setNewEntryOpen(true)}>
            + New
          </Button>
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
          <Button size="sm">
            {view === 'Year'
              ? 'Plan year'
              : view === 'Month'
                ? 'Plan month'
                : view === 'Day'
                  ? 'Plan day'
                  : 'Plan week'}
          </Button>
        </View>

        {/* Layer chips (ADR-0072 D3, ux-vision §2.7): Ruhe als Default — the canvas
            shows the accepted plan + now-line; every extra layer is one explicit tap,
            persisted per user. Replaces the old "View" popover on the canvas views. */}
        {(view === 'Week' || view === 'Day') && <PlannerLayerChips chips={layerChips} />}

        {/* Backlog rail + "Fülle meine Woche" (REQ-073, ADR-0072 D2, #340): the rail
            claims the calm canvas's reserved Backlog layer slot — its own self-contained
            closed-by-default pill sits in the layer-controls region, a peer of the
            reality/ghosts/life/capacity chips (ux-vision §2.7). Every feed, the packWeek
            run, the plan-apply confirm and the persisted read-back live inside it. */}
        {view === 'Week' && <PlannerBacklogRail weekDates={weekDates} />}

        {/* Sevi first run (REQ-074): the empty planner is Sevi's stage, not a dead
            wall — three answers → the first ghost week → one tap through the seam
            (provenance `planner-firstrun`). Skippable; never returns once done. */}
        {(view === 'Week' || view === 'Day') && showFirstRun && (
          <SeviFirstRun
            weekDates={weekDates}
            todayKey={todayMidnightKey}
            onAccepted={() => {
              setPref('plannerFirstRunDone', true)
              weekPlans.reload()
            }}
            onSkip={() => setPref('plannerFirstRunDone', true)}
          />
        )}

        {/* In-bar start-picker (design v20 day-tracker row): pick a project + optional task and
            start the shared live timer straight from the Planner — real catalog, real timer,
            start/stop toasts. Additive: the week canvas, ghosts and reality overlay are untouched. */}
        {view === 'Week' && <PlannerStartPicker clients={catalog.data ?? []} />}

        {/* Capacity head-trace (design v14 §F Stufe 2): the week's TRUE plannable capacity —
            the contracted target minus your own life/protected commitments ("KW32 nur 24h"),
            from the deterministic `weekCapacity` core (ADR-0005). Honest by construction: with
            no life blocks it reads the full target, and the sage segment grows as life does.
            A chip layer since the calm default (issue #341) — open Capacity to see it. */}
        {view === 'Week' &&
          prefs.plannerLayerCapacity &&
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

        {/* Sevi Scrum-Master at planning time (REQ-070, ADR-0071): ONE calm banner when the
            week's planned load exceeds the honest plannable capacity, with confirm-gated
            relief routed through the plan-apply seam. Renders nothing when the plan fits. */}
        {view === 'Week' && (
          <SeviAdvisory blocks={blocks} weekDates={weekDates} occurrences={occurrences} />
        )}

        {view === 'Day' &&
          (() => {
            // "Today" is the day stage of the Planner (design v20): the tracker row starts the
            // shared timer, and one full-width DayColumn shows the day's plan + reality on the same
            // 08–18 canvas the week uses — same blocks, same deterministic geometry (ADR-0005), so
            // nothing is duplicated or mocked. Today (in another visible day) falls back to column 0.
            const dayIdx = weekDays.findIndex(d => d.today === true)
            const dayI = dayIdx >= 0 ? dayIdx : 0
            const day = weekDays[dayI]
            if (day === undefined) return null
            // All-day banner (design v20): if a real absence covers the shown day, surface it above
            // the grid — vacation/sick/holiday is not a plannable slot. From live absences, no mock.
            const dayKey = localDayKey(day.dateMs)
            const dayAbsence = (absences.data?.upcoming ?? []).find(
              a => dayKey >= a.startDate && dayKey <= a.endDate,
            )
            return (
              <>
                {dayAbsence && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: t.spacing.s2,
                      paddingHorizontal: t.spacing.s3,
                      paddingVertical: t.spacing.s2,
                      borderRadius: t.radius.block,
                      borderLeftWidth: 3,
                      borderLeftColor: t.color.warn,
                      backgroundColor: t.color.warnSoft,
                    }}
                  >
                    <Text
                      style={{ fontSize: t.fontSize.xs, fontWeight: '700', color: t.color.ink }}
                    >
                      {`◦ ${dayAbsence.kind.charAt(0).toUpperCase()}${dayAbsence.kind.slice(1)}`}
                    </Text>
                    <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>
                      all day — not a plannable slot
                    </Text>
                  </View>
                )}
                <PlannerDayTracker clients={catalog.data ?? []} />
                {/* One-tap day repair (ADR-0072 D1): drift chip → ghost preview → one tap. */}
                <DayRepairSheet repair={dayRepair} />
                {/* Canvas ⇄ List toggle (REQ-040): the same day, geometry or flat list. */}
                <View style={{ maxWidth: 220 }}>
                  <SegmentedControl<'canvas' | 'list'>
                    segments={[
                      { value: 'canvas', label: 'Canvas' },
                      { value: 'list', label: 'List' },
                    ]}
                    active={dayMode}
                    onChange={setDayMode}
                  />
                </View>
                <View
                  style={{
                    flexDirection: stacked ? 'column' : 'row',
                    gap: t.spacing.s4,
                    alignItems: 'flex-start',
                  }}
                >
                  {dayMode === 'list' ? (
                    // Classic day list (REQ-040): the day's editable blocks + read-only recurring
                    // occurrences, sorted by start; a tap opens the same drawer as the canvas.
                    <View style={{ flex: stacked ? undefined : 1, alignSelf: 'stretch' }}>
                      <PlannerDayList
                        items={[
                          ...shownBlocks
                            .map((b, index) => ({ b, index }))
                            .filter(x => x.b.day === dayI)
                            .map(({ b, index }): DayListItem => ({
                              key: `b-${String(index)}`,
                              label: b.label,
                              timeLabel: `${clock(b.start)}–${clock(b.start + b.len)}`,
                              lenMin: b.len,
                              color: canvasBlockColor(t, b),
                              typeLabel: canvasKindLabel(b.kind),
                              onOpen: () => setOpenIndex(index),
                            })),
                          ...recurringBlocks
                            .filter(rb => rb.day === dayI)
                            .map((rb, ri): DayListItem => ({
                              key: `r-${String(ri)}`,
                              label: rb.label,
                              timeLabel: `${clock(rb.start)}–${clock(rb.start + rb.len)}`,
                              lenMin: rb.len,
                              color: canvasBlockColor(t, rb),
                              typeLabel: `↻ ${canvasKindLabel(rb.kind)}`,
                            })),
                        ].sort((a, b) => a.timeLabel.localeCompare(b.timeLabel))}
                      />
                    </View>
                  ) : (
                    <Card
                      padding={false}
                      style={{ flex: stacked ? undefined : 1, alignSelf: 'stretch' }}
                    >
                      {webTimegrid && weekStartMs !== undefined ? (
                        // Web (design v20 §Cal): FullCalendar's editable timegrid for the single day —
                        // drag/resize/create/open all route to the same handlers the RN canvas uses.
                        <PlannerCalendar
                          view="day"
                          year={calYear}
                          month0={calMonth0}
                          today={calToday}
                          anchorDate={localDayKey(day.dateMs)}
                          occurrences={occurrences.filter(o => inLayer(o.kind, layer))}
                          targetHours={DAILY_TARGET_HOURS}
                          editableBlocks={timegridBlocks}
                          planBlocks={planCanvasBlocks}
                          weekStartMs={weekStartMs}
                          {...(expandedBand !== undefined
                            ? {
                                windowStartMin: expandedBand.startMin,
                                windowEndMin: expandedBand.endMin,
                              }
                            : {})}
                          onBlockMove={moveBlock}
                          onBlockResize={resizeBlock}
                          onBlockOpen={setOpenIndex}
                          onSlotCreate={(d, min) => createBlockAt(d, min)}
                        />
                      ) : (
                        <View style={{ flexDirection: 'row' }}>
                          <HourGutter bands={bands} />
                          <View
                            style={{ flex: 1 }}
                            onLayout={e => {
                              const w = e.nativeEvent.layout.width
                              if (w > 0) setDayColW(w)
                            }}
                          >
                            <DayColumn
                              day={day}
                              index={dayI}
                              flex
                              blocks={shownBlocks}
                              planBlocks={planCanvasBlocks}
                              recurring={recurringBlocks}
                              bands={bands}
                              colWidth={dayColW}
                              onResizeBlock={resizeBlock}
                              onMoveBlock={moveBlock}
                              onOpenBlock={setOpenIndex}
                              showReality={showReality}
                              onCreateAt={min => createBlockAt(dayI, min)}
                              eveningZone
                              nonWorking={[0, 6].includes(new Date(day.dateMs).getDay())}
                            />
                          </View>
                        </View>
                      )}
                    </Card>
                  )}
                  {/* Instruments rail — glanceable day signals from real data (design v20). */}
                  <PlannerDayInstruments />
                </View>
                <Legend />
              </>
            )
          })()}

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

            {/* Sevi life-care voices (ADR-0071 P5, REQ-071) — renders only when delivered. */}
            <LifeCareCard weekDates={weekDates} />

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
                {webTimegrid && weekStartMs !== undefined ? (
                  // Web (design v20 §Cal): FullCalendar's editable 7-day timegrid — same blocks, same
                  // move/resize/create/open handlers as the RN columns, so nothing behaves differently.
                  <PlannerCalendar
                    view="week"
                    year={calYear}
                    month0={calMonth0}
                    today={calToday}
                    anchorDate={localDayKey(weekStartMs)}
                    occurrences={occurrences.filter(o => inLayer(o.kind, layer))}
                    targetHours={DAILY_TARGET_HOURS}
                    editableBlocks={timegridBlocks}
                    planBlocks={planCanvasBlocks}
                    weekStartMs={weekStartMs}
                    {...(expandedBand !== undefined
                      ? {
                          windowStartMin: expandedBand.startMin,
                          windowEndMin: expandedBand.endMin,
                        }
                      : {})}
                    onBlockMove={moveBlock}
                    onBlockResize={resizeBlock}
                    onBlockOpen={setOpenIndex}
                    onSlotCreate={(d, min) => createBlockAt(d, min)}
                  />
                ) : (
                  <View style={{ flexDirection: 'row' }}>
                    <HourGutter bands={bands} />
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
                        extraData={{
                          shownBlocks,
                          planCanvasBlocks,
                          recurringBlocks,
                          bands,
                          colWidth,
                          stacked,
                          showReality,
                        }}
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
                              planBlocks={planCanvasBlocks}
                              recurring={recurringBlocks}
                              bands={bands}
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
                )}
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

        {/* Month view (design v18 PlannerViews): tasks = filled chips (project color + priority
            dot), events = hollow banners that never count, day-load bar vs the daily target. Real
            occurrences; an empty month renders an honest empty grid. */}
        {(view === 'Month' || view === 'Year') && (
          <PlannerCalendar
            view={view === 'Month' ? 'month' : 'year'}
            year={calYear}
            month0={calMonth0}
            today={calToday}
            occurrences={shownCalOccurrences}
            targetHours={DAILY_TARGET_HOURS}
            // Woche ⇄ Monat navigation (REQ-037): a month day drills into the Day view; a year
            // month drills into the Month view. The segmented control is the reverse zoom out.
            onDrillDay={() => setView('Day')}
            onDrillMonth={() => setView('Month')}
          />
        )}
      </ScrollView>
      <PlannerEntryDrawer
        key={openIndex ?? 'none'}
        entry={drawerEntry}
        onClose={() => setOpenIndex(null)}
        {...(drawerEntry?.kind === 'meeting' ? { onRsvp: setOpenRsvp } : {})}
        {...(drawerEntry?.kind === 'actual'
          ? { onDelete: removeOpen, onNudge: nudgeOpen, onDuplicate: duplicateOpen }
          : {})}
        {...(drawerEntry?.kind === 'travel' ? { onTravelDetail: saveTravelDetail } : {})}
        {...(drawerEntry?.kind === 'ghost' ? { onAccept: acceptOpen, onDismiss: removeOpen } : {})}
        {...(drawerEntry !== null &&
        (drawerEntry.kind === 'meeting' ||
          drawerEntry.kind === 'actual' ||
          drawerEntry.kind === 'life')
          ? { onProtect: setOpenProtected, onRecurrence: makeOpenRecurring }
          : {})}
      />
      <PlannerNewEntryDialog
        visible={newEntryOpen}
        projects={dialogProjects}
        busy={creatingEntry}
        onClose={() => setNewEntryOpen(false)}
        onSubmit={submitNewEntry}
        onCreateProject={createDialogProject}
      />
    </View>
  )
}
