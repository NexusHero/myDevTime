import { Fragment } from 'react'
import { Pressable, View } from 'react-native'
import {
  dayLoad,
  loadTone,
  projectColor,
  projectColors,
  weekdayHeaders,
  type LoadTone,
  type Theme,
} from '@mydevtime/design'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'
import { FlagGlyph } from './FlagGlyph'
import { MONTH, MONTH_DAYS, type MonthDay } from '../../screens/plannerViewsData'

/**
 * Planner — **Monat** facet (design v6). A 7-column month grid where each day
 * separates **tasks** (filled chips with a priority dot + project color; they
 * count toward the day's prio-weighted load) from **events** (a hollow dashed
 * banner with a pennant; they never count, never block). A slim "Schwere" bar
 * shows the day's load vs the daily target, toned via the pure `loadTone`
 * (ADR-0005 — the numbers are the design core's; the view only draws them).
 */

/** Map a load tone to its theme color. */
function toneColor(t: Theme, tone: LoadTone): string {
  switch (tone) {
    case 'idle':
      return t.color.border
    case 'good':
      return t.color.good
    case 'warn':
      return t.color.warn
    case 'crit':
      return t.color.crit
  }
}

const PRIO_DOT = (t: Theme): Record<1 | 2 | 3, string> => ({
  1: t.color.crit,
  2: t.color.warn,
  3: t.color.ink3,
})

/** One month-grid cell: a real day, or a null spacer for the leading/trailing pad. */
function MonthCell({
  day,
  info,
  weekend,
  onDrill,
}: {
  readonly day: number | null
  readonly info: MonthDay
  readonly weekend: boolean
  readonly onDrill?: ((day: number) => void) | undefined
}): React.JSX.Element {
  const t = useTheme()
  if (day === null) {
    return (
      <View
        style={{
          flex: 1,
          minHeight: 96,
          borderBottomWidth: 1,
          borderBottomColor: t.color.border,
          borderLeftWidth: 1,
          borderLeftColor: t.color.border,
          backgroundColor: t.color.sunk,
          opacity: 0.4,
        }}
      />
    )
  }
  const eventColor = projectColors[t.mode][1] ?? t.color.ink2
  const dot = PRIO_DOT(t)
  const load = dayLoad(info.tasks)
  const tone = toneColor(t, loadTone(load, MONTH.sollHours))
  const isToday = day === MONTH.today
  const shown = info.tasks.slice(0, 3)
  const extra = info.tasks.length - shown.length

  return (
    <Pressable
      onPress={() => onDrill?.(day)}
      accessibilityRole="button"
      accessibilityLabel={`${String(day)}. Juli`}
      style={{
        flex: 1,
        minHeight: 96,
        paddingHorizontal: 6,
        paddingTop: 5,
        paddingBottom: 7,
        gap: 3,
        borderBottomWidth: 1,
        borderBottomColor: t.color.border,
        borderLeftWidth: 1,
        borderLeftColor: t.color.border,
        backgroundColor: isToday ? t.color.accentSoft : weekend ? t.color.sunk : 'transparent',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text
          style={{
            fontFamily: t.fontFamily.numeric,
            fontSize: 11,
            fontWeight: isToday ? '700' : '600',
            color: isToday ? '#ffffff' : weekend ? t.color.ink3 : t.color.ink2,
            backgroundColor: isToday ? t.color.live : 'transparent',
            borderRadius: t.radius.pill,
            paddingHorizontal: isToday ? 7 : 0,
            overflow: 'hidden',
          }}
        >
          {day}
        </Text>
        {load > 0 && (
          <Text
            style={{
              marginLeft: 'auto',
              fontFamily: t.fontFamily.numeric,
              fontSize: 9,
              color: t.color.ink3,
            }}
          >
            {load.toFixed(1).replace('.', ',')}
          </Text>
        )}
      </View>

      {/* Events — hollow dashed banner + pennant: never work, never counted. */}
      {info.events.map(ev => (
        <View
          key={ev}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 5,
            paddingVertical: 2,
            borderRadius: 4,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: eventColor,
          }}
        >
          <FlagGlyph color={eventColor} size={9} />
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 9.5,
              fontWeight: '600',
              fontStyle: 'italic',
              color: eventColor,
            }}
          >
            {ev}
          </Text>
        </View>
      ))}

      {/* Tasks — filled chip, priority dot + project color left border. */}
      {shown.map((task, i) => (
        <View
          key={`${task.label}-${String(i)}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 5,
            paddingVertical: 2,
            borderRadius: 4,
            borderLeftWidth: 2.5,
            borderLeftColor: projectColor(task.project, t.mode),
            backgroundColor: `${projectColor(task.project, t.mode)}26`,
          }}
        >
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: dot[task.prio] }} />
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontSize: 9.5, fontWeight: '600', color: t.color.ink }}
          >
            {task.label}
          </Text>
        </View>
      ))}
      {extra > 0 && (
        <Text style={{ fontSize: 9, fontWeight: '700', color: t.color.ink3 }}>
          +{extra} weitere
        </Text>
      )}

      {/* Schwere bar — prio-weighted load vs the daily target. */}
      <View
        style={{
          marginTop: 'auto',
          height: 3,
          borderRadius: 2,
          backgroundColor: t.color.sunk,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.min(load / MONTH.sollHours, 1) * 100}%`,
            height: '100%',
            borderRadius: 2,
            backgroundColor: tone,
          }}
        />
      </View>
    </Pressable>
  )
}

const EMPTY_DAY: MonthDay = { tasks: [], events: [] }

export function PlannerMonthView({
  onDrill,
}: {
  readonly onDrill?: (day: number) => void
}): React.JSX.Element {
  const t = useTheme()
  const headers = weekdayHeaders(true)

  // Build the padded cell list (leading offset + days + trailing pad to fill the week).
  const cells: (number | null)[] = []
  for (let i = 0; i < MONTH.offset; i++) cells.push(null)
  for (let d = 1; d <= MONTH.days; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const rows: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  return (
    <View>
      <View
        style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.color.border }}
      >
        {headers.map(w => (
          <Text
            key={w}
            style={{
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 10,
              fontSize: 10,
              fontWeight: '700',
              color: t.color.ink3,
              letterSpacing: 10 * t.letterSpacing.wide,
              textTransform: 'uppercase',
            }}
          >
            {w}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((day, ci) => (
            <Fragment key={ci}>
              <MonthCell
                day={day}
                info={day !== null ? (MONTH_DAYS[day] ?? EMPTY_DAY) : EMPTY_DAY}
                weekend={ci >= 5}
                onDrill={onDrill}
              />
            </Fragment>
          ))}
        </View>
      ))}
    </View>
  )
}
