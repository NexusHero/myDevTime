import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { formatDuration } from '@mydevtime/design'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'
import { useWorktime } from '../../hooks/useWorktime'

/**
 * The Planner Day **instruments rail** (design v20 `PlannerDay` rail): a slim column of glanceable
 * day signals beside the canvas. It shows only what is **real** (ADR-0005) — the live punch clock
 * (clocked state + overtime balance from `useWorktime`) and a standing mood check — and never
 * fabricates figures: with nothing clocked it says so rather than inventing a bar. Collapsible so
 * it never crowds the canvas. English copy (UI is English-only).
 *
 * The auto-tracker "today" breakdown and the AI day-draft queue are wired in later slices from
 * their own real sources; this rail carries the signals that already have live data.
 */
type Mood = 'good' | 'okay' | 'stressed'

const MOODS: readonly { readonly id: Mood; readonly label: string }[] = [
  { id: 'good', label: 'Good' },
  { id: 'okay', label: 'Okay' },
  { id: 'stressed', label: 'Stressed' },
]

/** ±HH:MM balance from a signed millisecond overtime figure. */
function signedBalance(ms: number): string {
  const sign = ms >= 0 ? '+' : '−'
  return `${sign}${formatDuration(Math.abs(ms))} h`
}

export function PlannerDayInstruments(): React.JSX.Element {
  const t = useTheme()
  const worktime = useWorktime()
  const [mood, setMood] = useState<Mood | null>(null)

  const clockedIn = worktime.running !== null
  const moodTone: Record<Mood, string> = {
    good: t.color.good,
    okay: t.color.warn,
    stressed: t.color.crit,
  }

  const card = {
    gap: t.spacing.s2,
    padding: t.spacing.s3,
    borderRadius: t.radius.block,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  } as const
  const cardTitle = {
    fontSize: t.fontSize['2xs'],
    fontWeight: '700' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    color: t.color.ink3,
  }

  return (
    <View style={{ gap: t.spacing.s3, width: 260 }}>
      {/* Today — the live punch clock, real numbers only. */}
      <View style={card}>
        <Text style={cardTitle}>Today</Text>
        {clockedIn ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.s2 }}>
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color.live }}
              accessibilityElementsHidden
            />
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize.lg,
                color: t.color.ink,
              }}
            >
              {worktime.elapsed}
            </Text>
            <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>clocked</Text>
          </View>
        ) : (
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>Not clocked in</Text>
        )}
        <Text
          style={{
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize.xs,
            color: worktime.overtimeMs > 0 ? t.color.warn : t.color.ink2,
          }}
        >
          {`Overtime balance ${signedBalance(worktime.overtimeMs)}`}
        </Text>
      </View>

      {/* Mood — a standing, one-tap strain signal (OLBI); the pick stays on the day. */}
      <View style={card}>
        <Text style={cardTitle}>How's it going?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
          {MOODS.map(o => {
            const on = o.id === mood
            return (
              <Pressable
                key={o.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={o.label}
                onPress={() => setMood(on ? null : o.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: t.spacing.s3,
                  paddingVertical: 6,
                  borderRadius: t.radius.pill,
                  backgroundColor: on ? t.color.accentSoft : t.color.sunk,
                  borderWidth: 1,
                  borderColor: on ? t.color.accent : t.color.border,
                }}
              >
                <View
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: moodTone[o.id] }}
                />
                <Text
                  style={{
                    fontSize: t.fontSize['2xs'],
                    fontWeight: '600',
                    color: on ? t.color.accent : t.color.ink2,
                  }}
                >
                  {o.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    </View>
  )
}
