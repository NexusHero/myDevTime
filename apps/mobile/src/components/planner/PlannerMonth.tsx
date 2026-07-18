import { Pressable, View } from 'react-native'
import {
  bookingGapDays,
  dayLoad,
  loadTone,
  monthGrid,
  projectColor,
  weekdayHeaders,
} from '@mydevtime/design'
import type { LoadTone } from '@mydevtime/design'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'
import type { Theme } from '@mydevtime/design'
import type { MonthDay } from '../../planner/calendarMonth'

/**
 * Planner **Month** view (design v18 PlannerViews). The ground law: **tasks** (planned work) count
 * toward the day's load and wear a project color + priority dot; **events** (holiday, company event,
 * absence) never count and never block — they surface as a hollow dashed banner. Each cell shows the
 * day number (today in a live-orange pill), up to three tasks + "+N more", any events, and a
 * priority-weighted load bar (`dayLoad`/`loadTone` from `@mydevtime/design`). All data is real
 * (`buildMonthDays`); an empty month renders an honest empty grid. The month layer never books —
 * tapping a day drills into it. (Events are neutral, never violet — violet is the AI signature.)
 */
export interface PlannerMonthProps {
  readonly year: number
  /** 0-based month (0 = January). */
  readonly month0: number
  /** Day-of-month to flag as today, or 0 when today is in another month. */
  readonly today: number
  /** Per-day contents, keyed by day-of-month (from `buildMonthDays`). */
  readonly days: ReadonlyMap<number, MonthDay>
  /** The daily target hours the load bar/tone compares against. */
  readonly targetHours: number
  readonly onDrill?: (day: number) => void
}

const PRIO_DOT = (t: Theme, prio: number): string =>
  prio === 1 ? t.color.crit : prio === 2 ? t.color.warn : t.color.ink3

const LOAD_COLOR: Record<LoadTone, (t: Theme) => string> = {
  idle: t => t.color.border,
  good: t => t.color.good,
  warn: t => t.color.warn,
  crit: t => t.color.crit,
}

function fmtLoad(load: number): string {
  return load.toFixed(1)
}

export function PlannerMonth({
  year,
  month0,
  today,
  days,
  targetHours,
  onDrill,
}: PlannerMonthProps): React.JSX.Element {
  const t = useTheme()
  const weeks = monthGrid(year, month0)
  const headers = weekdayHeaders(true)
  // Booking-gap markers (design v13 §K / competitor parity, REQ-037): the past weekdays with no
  // entry — an honest "nothing booked here". Deterministic (`bookingGapDays`, ADR-0005): only the
  // current month has a "today" cutoff, so nothing in the future is ever flagged as missed.
  const bookedDays = new Set(
    [...days].filter(([, d]) => d.tasks.length > 0 || d.events.length > 0).map(([day]) => day),
  )
  const gapDays = new Set(bookingGapDays(year, month0, bookedDays, today > 0 ? today - 1 : 0))

  return (
    <View style={{ flex: 1 }}>
      {/* Weekday header row */}
      <View
        style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.color.border }}
      >
        {headers.map(w => (
          <View
            key={w}
            style={{ flex: 1, paddingVertical: t.spacing.s2, paddingHorizontal: t.spacing.s2 }}
          >
            <Text
              style={{
                fontSize: t.fontSize['2xs'],
                fontWeight: '700',
                color: t.color.ink3,
                letterSpacing: 0.6,
              }}
            >
              {w.toUpperCase()}
            </Text>
          </View>
        ))}
      </View>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row' }}>
          {week.map((cell, ci) => {
            const weekend = ci >= 5
            if (!cell.inMonth) {
              return (
                <View
                  key={ci}
                  style={{
                    flex: 1,
                    minHeight: 92,
                    borderBottomWidth: 1,
                    borderBottomColor: t.color.border,
                    borderLeftWidth: ci === 0 ? 0 : 1,
                    borderLeftColor: t.color.border,
                    backgroundColor: t.color.sunk,
                    opacity: 0.4,
                  }}
                />
              )
            }
            const data = days.get(cell.date)
            const tasks = data?.tasks ?? []
            const events = data?.events ?? []
            const load = data?.load ?? dayLoad([])
            const isToday = cell.date === today
            const shown = tasks.slice(0, 3)
            const tone = loadTone(load, targetHours)
            const hasActivity = tasks.length > 0 || events.length > 0
            const isGap = gapDays.has(cell.date)

            return (
              <Pressable
                key={ci}
                accessibilityRole="button"
                accessibilityLabel={
                  isGap
                    ? `${String(cell.date)} — nothing booked`
                    : `${String(cell.date)} — ${String(tasks.length)} tasks`
                }
                onPress={() => onDrill?.(cell.date)}
                style={{
                  flex: 1,
                  minHeight: 92,
                  paddingHorizontal: 6,
                  paddingTop: 5,
                  paddingBottom: 7,
                  gap: 3,
                  borderBottomWidth: 1,
                  borderBottomColor: t.color.border,
                  borderLeftWidth: ci === 0 ? 0 : 1,
                  borderLeftColor: t.color.border,
                  backgroundColor: isToday
                    ? t.color.accentSoft
                    : weekend
                      ? t.color.sunk
                      : 'transparent',
                }}
              >
                {/* Day number + load figure */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    style={{
                      fontFamily: t.fontFamily.numeric,
                      fontSize: t.fontSize['2xs'],
                      fontWeight: isToday ? '700' : '600',
                      color: isToday ? t.color.accentInk : weekend ? t.color.ink3 : t.color.ink2,
                      backgroundColor: isToday ? t.color.live : 'transparent',
                      borderRadius: t.radius.pill,
                      paddingHorizontal: isToday ? 6 : 0,
                      paddingVertical: isToday ? 1 : 0,
                      overflow: 'hidden',
                    }}
                  >
                    {cell.date}
                  </Text>
                  {/* Activity dot (REQ-037): a filled accent dot marks a day that has any entry. */}
                  {hasActivity && (
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        marginLeft: 4,
                        backgroundColor: t.color.accent,
                      }}
                    />
                  )}
                  {/* Booking-gap marker (REQ-037): a hollow warn ring on a past weekday with no
                      entry — an honest "nothing booked here", never on a future day or weekend. */}
                  {isGap && (
                    <View
                      accessibilityLabel="Nothing booked"
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        marginLeft: 4,
                        borderWidth: 1,
                        borderColor: t.color.warn,
                      }}
                    />
                  )}
                  {load > 0 && (
                    <Text
                      style={{
                        marginLeft: 'auto',
                        fontFamily: t.fontFamily.numeric,
                        fontSize: 9,
                        color: t.color.ink3,
                      }}
                    >
                      {fmtLoad(load)}
                    </Text>
                  )}
                </View>

                {/* Events — hollow dashed banner, never counted (neutral, not violet) */}
                {events.map(ev => (
                  <View
                    key={ev.label}
                    style={{
                      paddingHorizontal: 5,
                      paddingVertical: 2,
                      borderRadius: 4,
                      borderWidth: 1,
                      borderStyle: 'dashed',
                      borderColor: t.color.ink3,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 9, fontStyle: 'italic', color: t.color.ink3 }}
                    >
                      {ev.label}
                    </Text>
                  </View>
                ))}

                {/* Tasks — filled chip: project-color left border + priority dot. Life is
                    personal (design v19 §F): sage left-border, no priority dot, never counted. */}
                {shown.map((task, ti) => (
                  <View
                    key={ti}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: 5,
                      paddingVertical: 2,
                      borderRadius: 4,
                      backgroundColor: task.isLife ? t.color.lifeSoft : t.color.sunk,
                      borderLeftWidth: 2.5,
                      borderLeftColor: task.isLife
                        ? t.color.life
                        : task.projectId != null
                          ? projectColor(task.projectId, t.mode)
                          : t.color.accent,
                    }}
                  >
                    {!task.isLife && (
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: PRIO_DOT(t, task.prio),
                        }}
                      />
                    )}
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        fontSize: 9,
                        color: task.isLife ? t.color.life : t.color.ink,
                      }}
                    >
                      {task.label}
                    </Text>
                  </View>
                ))}
                {tasks.length > 3 && (
                  <Text style={{ fontSize: 9, fontWeight: '700', color: t.color.ink3 }}>
                    {`+${String(tasks.length - 3)} more`}
                  </Text>
                )}

                {/* Load bar — priority-weighted hours vs the daily target */}
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
                      width: `${Math.min(targetHours > 0 ? load / targetHours : 0, 1) * 100}%`,
                      height: '100%',
                      borderRadius: 2,
                      backgroundColor: LOAD_COLOR[tone](t),
                    }}
                  />
                </View>
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}
