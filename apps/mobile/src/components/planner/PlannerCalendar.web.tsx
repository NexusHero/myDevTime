import { useMemo } from 'react'
import { View } from 'react-native'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import multiMonthPlugin from '@fullcalendar/multimonth'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventContentArg, EventInput } from '@fullcalendar/core'
import { projectColor } from '@mydevtime/design'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'
import type { PlannerCalendarProps } from './PlannerCalendar'

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
  occurrences,
  onDrillDay,
  onDrillMonth,
}: PlannerCalendarProps): React.JSX.Element {
  const t = useTheme()

  const events = useMemo<EventInput[]>(
    () =>
      occurrences.map((o, i) => {
        const isLife = o.kind === 'life'
        const color = isLife
          ? t.color.life
          : o.projectId != null
            ? projectColor(o.projectId, t.mode)
            : t.color.accent
        return {
          id: `${o.seriesId}-${o.date}-${String(i)}`,
          title: o.title,
          start: `${o.date}T${hhmm(o.startMin)}:00`,
          end: `${o.date}T${hhmm(Math.min(o.startMin + o.lenMin, 1439))}:00`,
          extendedProps: { color, isLife, priority: o.priority },
        }
      }),
    [occurrences, t.color.life, t.color.accent, t.mode],
  )

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

  return (
    <View style={{ flex: 1, minHeight: 480 }}>
      <FullCalendar
        key={`${view}-${String(year)}-${String(month0)}`}
        plugins={[dayGridPlugin, multiMonthPlugin, interactionPlugin]}
        initialView={view === 'year' ? 'multiMonthYear' : 'dayGridMonth'}
        initialDate={`${String(year)}-${pad2(month0 + 1)}-01`}
        firstDay={1}
        headerToolbar={false}
        height="auto"
        events={events}
        eventContent={renderEvent}
        dayMaxEvents={3}
        dateClick={info => onDrillDay?.(info.date.getDate())}
        navLinks={view === 'year'}
        navLinkDayClick={(date: Date) => onDrillMonth?.(date.getMonth())}
      />
    </View>
  )
}
