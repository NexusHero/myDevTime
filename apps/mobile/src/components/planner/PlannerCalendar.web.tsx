import { useMemo } from 'react'
import { View } from 'react-native'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import multiMonthPlugin from '@fullcalendar/multimonth'
import interactionPlugin from '@fullcalendar/interaction'
import type {
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { projectColor } from '@mydevtime/design'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'
import type { PlannerCalendarProps } from './PlannerCalendar'

/** The canvas window start hour — matches the RN `DayColumn` (08:00) and `slotMinTime` below. */
const START_HOUR = 8
const DAY_MS = 86_400_000

/** Absolute local `Date` for a `day`-offset + minutes-from-08:00, anchored on the week's Monday. */
function blockStart(weekStartMs: number, day: number, startMin: number): Date {
  return new Date(weekStartMs + day * DAY_MS + (START_HOUR * 60 + startMin) * 60_000)
}

/** Inverse of {@link blockStart}: a dropped/selected `Date` → `{ day, startMin }` on the canvas. */
function toDayMin(weekStartMs: number, at: Date): { day: number; startMin: number } {
  const midnight = new Date(at)
  midnight.setHours(0, 0, 0, 0)
  const day = Math.round((midnight.getTime() - weekStartMs) / DAY_MS)
  const startMin = at.getHours() * 60 + at.getMinutes() - START_HOUR * 60
  return { day, startMin }
}

/**
 * The **web** Planner calendar (design v20, ADR-0068): FullCalendar drives the Month/Year grid,
 * scrolling and layout, but every figure still comes from the deterministic occurrences we pass
 * (ADR-0005) and every event renders through our **own** `eventContent` — a project-color (or sage
 * `--life`) chip with a priority dot — so we never ship FullCalendar's default theme. This file is
 * bundled only on web (Metro resolves the native `PlannerCalendar.tsx` on iOS/Android and in tests),
 * so the DOM-only library never reaches native (ADR-0004).
 */

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** `minute-of-day` → `HH:MM` for an event's start/end on its calendar day. */
function hhmm(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60)
  const m = minuteOfDay % 60
  return `${pad2(h)}:${pad2(m)}`
}

export function PlannerCalendar({
  view,
  year,
  month0,
  anchorDate,
  occurrences,
  onDrillDay,
  onDrillMonth,
  editableBlocks,
  weekStartMs,
  onBlockMove,
  onBlockResize,
  onBlockOpen,
  onSlotCreate,
}: PlannerCalendarProps): React.JSX.Element {
  const t = useTheme()

  // The week/day timegrid is editable when the Planner wired handlers and gave a week anchor; the
  // month/year grids never are. FullCalendar only moves the DOM — every figure is still ours.
  const timegrid = view === 'week' || view === 'day'
  const editable = timegrid && weekStartMs != null && onBlockMove != null

  // FullCalendar view + start date per zoom (design v20 §Cal, ADR-0068): the timegrid week/day
  // carry the same MIT plugins and custom event renderer, so the look stays ours, not the library's.
  const fcView =
    view === 'year'
      ? 'multiMonthYear'
      : view === 'week'
        ? 'timeGridWeek'
        : view === 'day'
          ? 'timeGridDay'
          : 'dayGridMonth'
  const fcDate =
    (view === 'week' || view === 'day') && anchorDate != null
      ? anchorDate
      : `${String(year)}-${pad2(month0 + 1)}-01`

  const events = useMemo<EventInput[]>(() => {
    // Read-only recurring occurrences (design v17 §F4): projected from a stored series, so they
    // never drag — like the RN canvas's ↻ ghosts.
    const occEvents: EventInput[] = occurrences.map((o, i) => {
      const isLife = o.kind === 'life'
      const color = isLife
        ? t.color.life
        : o.projectId != null
          ? projectColor(o.projectId, t.mode)
          : t.color.accent
      return {
        id: `occ-${o.seriesId}-${o.date}-${String(i)}`,
        title: o.title,
        start: `${o.date}T${hhmm(o.startMin)}:00`,
        end: `${o.date}T${hhmm(Math.min(o.startMin + o.lenMin, 1439))}:00`,
        editable: false,
        extendedProps: { color, isLife, priority: o.priority, blockIndex: null },
      }
    })
    // Editable local canvas blocks (design v20 §Cal): the ones FullCalendar can drag/resize; each
    // carries its `blockIndex` so a drop maps straight back to the Planner's move/resize handler.
    const blockEvents: EventInput[] =
      weekStartMs == null
        ? []
        : (editableBlocks ?? []).map(b => ({
            id: `blk-${String(b.index)}`,
            title: b.label,
            start: blockStart(weekStartMs, b.day, b.startMin),
            end: blockStart(weekStartMs, b.day, b.startMin + b.lenMin),
            editable: true,
            extendedProps: {
              color: b.color,
              isLife: b.kind === 'life',
              priority: null,
              blockIndex: b.index,
            },
          }))
    return [...occEvents, ...blockEvents]
  }, [occurrences, editableBlocks, weekStartMs, t.color.life, t.color.accent, t.mode])

  const renderEvent = (arg: EventContentArg): React.JSX.Element => {
    const ext = arg.event.extendedProps as {
      color: string
      isLife: boolean
      priority: number | null
    }
    const prioColor =
      ext.priority === 1 ? t.color.crit : ext.priority === 2 ? t.color.warn : t.color.ink3
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 5,
          paddingVertical: 2,
          borderRadius: 4,
          backgroundColor: ext.isLife ? t.color.lifeSoft : t.color.sunk,
          borderLeftWidth: 2.5,
          borderLeftColor: ext.color,
        }}
      >
        {!ext.isLife && (
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: prioColor }} />
        )}
        <Text
          numberOfLines={1}
          style={{ fontSize: 9, color: ext.isLife ? t.color.life : t.color.ink }}
        >
          {arg.event.title}
        </Text>
      </View>
    )
  }

  // Timegrid drag: a block moved to a new day/time → the Planner's move handler (design v20 §Cal).
  const handleEventDrop = (info: EventDropArg): void => {
    const idx = info.event.extendedProps.blockIndex as number | null
    const at = info.event.start
    if (idx == null || at === null || weekStartMs == null || onBlockMove == null) return
    const { day, startMin } = toDayMin(weekStartMs, at)
    onBlockMove(idx, day, startMin)
  }
  // Timegrid resize: a block's bottom edge dragged → the Planner's resize handler.
  const handleEventResize = (info: EventResizeDoneArg): void => {
    const idx = info.event.extendedProps.blockIndex as number | null
    const start = info.event.start
    const end = info.event.end
    if (idx == null || start === null || end === null || onBlockResize == null) return
    onBlockResize(idx, Math.round((end.getTime() - start.getTime()) / 60_000))
  }
  // Timegrid click: an editable block opens its typed drawer; read-only occurrences don't.
  const handleEventClick = (info: EventClickArg): void => {
    const idx = info.event.extendedProps.blockIndex as number | null
    if (idx != null) onBlockOpen?.(idx)
  }
  // Timegrid select: dragging over empty time creates a block there (design v20 §Cal).
  const handleSelect = (info: DateSelectArg): void => {
    if (weekStartMs == null || onSlotCreate == null) return
    const { day, startMin } = toDayMin(weekStartMs, info.start)
    onSlotCreate(day, startMin)
  }

  return (
    <View style={{ flex: 1, minHeight: 480 }}>
      <FullCalendar
        key={`${view}-${String(year)}-${String(month0)}-${anchorDate ?? ''}`}
        plugins={[dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin]}
        initialView={fcView}
        initialDate={fcDate}
        firstDay={1}
        headerToolbar={false}
        height="auto"
        nowIndicator
        slotMinTime="08:00:00"
        slotMaxTime="22:00:00"
        snapDuration="00:15:00"
        editable={editable}
        eventStartEditable={editable}
        eventDurationEditable={editable}
        selectable={editable && onSlotCreate != null}
        events={events}
        eventContent={renderEvent}
        dayMaxEvents={3}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventClick={handleEventClick}
        select={handleSelect}
        dateClick={info => onDrillDay?.(info.date.getDate())}
        navLinks={view === 'year'}
        navLinkDayClick={(date: Date) => onDrillMonth?.(date.getMonth())}
      />
    </View>
  )
}
