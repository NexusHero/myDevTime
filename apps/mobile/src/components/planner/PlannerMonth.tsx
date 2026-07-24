import { Pressable, View } from 'react-native'
import {
  bookingGapDays,
  dayLoad,
  loadHeat,
  monthGrid,
  projectColor,
  weekdayHeaders,
  type HeatLevel,
} from '@mydevtime/design'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'
import type { Theme } from '@mydevtime/design'
import type { MonthDay } from '../../planner/calendarMonth'

/**
 * Planner **Month** view — redesigned as a calm, blue-accented heatmap (issue #366,
 * ADR-0075). The ground law is unchanged: **tasks** (planned work) count toward the
 * day's load and wear a project color + priority dot; **events** (holiday, company
 * event, absence) never count and never block — they surface as a hollow dashed banner.
 *
 * What changed: the dated yellow-and-numbers grid is gone. Each day is now a borderless
 * rounded cell whose **fill intensity** is the primary load signal — a 5-step accent-blue
 * scale (idle `bg` → `sunk` → `accentSoft` → `accentText` → `accent`) driven by the pure
 * [`loadHeat`](../../planner) helper. Day numbers shrink to a quiet `ink3` secondary role;
 * today wears a subtle accent ring (border), not a loud orange pill. The 3px amber load
 * bar and the inline load number are gone — the heat *is* the signal (numbers available on
 * tap via the a11y label). The booking-gap marker switches from `warn` to `ink3` (it's
 * information, not a warning). `live` orange is reserved strictly for "happening now"
 * (palette rule, ADR-0075). Every cell keeps an `accessibilityLabel` with day + load
 * (REQ-043) — the color is decorative, the label carries the meaning.
 */
export interface PlannerMonthProps {
  readonly year: number
  /** 0-based month (0 = January). */
  readonly month0: number
  /** Day-of-month to flag as today, or 0 when today is in another month. */
  readonly today: number
  /** Per-day contents, keyed by day-of-month (from `buildMonthDays`). */
  readonly days: ReadonlyMap<number, MonthDay>
  /** The daily target hours the heat scale compares against. */
  readonly targetHours: number
  readonly onDrill?: (day: number) => void
}

const PRIO_DOT = (t: Theme, prio: number): string =>
  prio === 1 ? t.color.crit : prio === 2 ? t.color.warn : t.color.ink3

/** The 5-step accent heat fill for a cell, driven by the pure `loadHeat` level. */
const HEAT_FILL: Record<HeatLevel, (t: Theme) => string> = {
  0: () => 'transparent',
  1: t => t.color.sunk,
  2: t => t.color.accentSoft,
  3: t => t.color.accentText,
  4: t => t.color.accent,
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
  // Booking-gap markers (REQ-037): the past weekdays with no entry — an honest "nothing
  // booked here". Deterministic (`bookingGapDays`, ADR-0005): only the current month has
  // a "today" cutoff, so nothing in the future is ever flagged as missed.
  const bookedDays = new Set(
    [...days].filter(([, d]) => d.tasks.length > 0 || d.events.length > 0).map(([day]) => day),
  )
  const gapDays = new Set(bookingGapDays(year, month0, bookedDays, today > 0 ? today - 1 : 0))

  return (
    <View style={{ flex: 1, gap: t.spacing.s1 }}>
      {/* Weekday header row */}
      <View style={{ flexDirection: 'row', gap: t.spacing.s1 }}>
        {headers.map(w => (
          <View
            key={w}
            style={{ flex: 1, paddingVertical: t.spacing.s1, paddingHorizontal: t.spacing.s2 }}
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

      {/* Week rows — borderless rounded cells with gap spacing (no hairline borders). */}
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row', gap: t.spacing.s1 }}>
          {week.map((cell, ci) => {
            const weekend = ci >= 5
            if (!cell.inMonth) {
              return (
                <View
                  key={ci}
                  style={{
                    flex: 1,
                    minHeight: 92,
                    borderRadius: t.radius.block,
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
            const heat = loadHeat(load, targetHours)
            const hasActivity = tasks.length > 0 || events.length > 0
            const isGap = gapDays.has(cell.date)

            return (
              <Pressable
                key={ci}
                accessibilityRole="button"
                accessibilityLabel={
                  isGap
                    ? `${String(cell.date)} — nothing booked`
                    : `${String(cell.date)} — ${load > 0 ? `${String(load)} hours` : 'no load'}`
                }
                onPress={() => onDrill?.(cell.date)}
                style={{
                  flex: 1,
                  minHeight: 92,
                  paddingHorizontal: 6,
                  paddingTop: 5,
                  paddingBottom: 7,
                  gap: 3,
                  borderRadius: t.radius.block,
                  // The heat fill IS the load signal — a 5-step accent-blue scale.
                  backgroundColor: HEAT_FILL[heat](t),
                  // Today wears a subtle accent ring (border), not a loud orange pill.
                  borderWidth: isToday ? 1.5 : 0,
                  borderColor: isToday ? t.color.accent : 'transparent',
                }}
              >
                {/* Day number — quiet ink3, small; today is bolder via the ring, not a pill. */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    style={{
                      fontFamily: t.fontFamily.numeric,
                      fontSize: t.fontSize['2xs'],
                      fontWeight: isToday ? '700' : '500',
                      color: isToday ? t.color.accentText : weekend ? t.color.ink3 : t.color.ink3,
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
                  {/* Booking-gap marker (REQ-037): a hollow ink3 ring on a past weekday with no
                      entry — information, not a warning (ADR-0075 corrects the old warn amber). */}
                  {isGap && (
                    <View
                      accessibilityLabel="Nothing booked"
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        marginLeft: 4,
                        borderWidth: 1,
                        borderColor: t.color.ink3,
                      }}
                    />
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
                      backgroundColor: t.color.surface,
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

                {/* Tasks — filled chip: project-color left border + priority dot. Lifted above
                    the heat fill with a subtle surface background so they stay legible. Life is
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
                      backgroundColor: task.isLife ? t.color.lifeSoft : t.color.surface,
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
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}
