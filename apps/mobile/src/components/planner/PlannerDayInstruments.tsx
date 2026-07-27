import { View } from 'react-native'
import { formatDuration } from '@mydevtime/design'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'
import { useWorktime } from '../../hooks/useWorktime'

/**
 * The Planner Day **instruments rail** (design v20 `PlannerDay` rail): a slim column of glanceable
 * day signals beside the canvas. It shows only what is **real** (ADR-0005) — the live punch clock
 * (clocked state + overtime balance from `useWorktime`) — and never fabricates figures: with
 * nothing clocked it says so rather than inventing a bar. Collapsible so it never crowds the
 * canvas. English copy (UI is English-only).
 *
 * Mood is **not** carried here: per REQ-068/ADR-0071 the mood signal is a transient one-tap row at
 * the punch-out moment (the shared `MoodCheck`), never a standing widget. A standing mood card here
 * duplicated it and collided with the punch-out row on the merged Day view (issue #369), so it was
 * removed; the auto-tracker "today" breakdown and the AI day-draft queue are wired in later slices.
 */

/** ±HH:MM balance from a signed millisecond overtime figure. */
function signedBalance(ms: number): string {
  const sign = ms >= 0 ? '+' : '−'
  return `${sign}${formatDuration(Math.abs(ms))} h`
}

export function PlannerDayInstruments(): React.JSX.Element {
  const t = useTheme()
  const worktime = useWorktime()

  const clockedIn = worktime.running !== null

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
    </View>
  )
}
