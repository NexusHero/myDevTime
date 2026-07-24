import { Pressable, View } from 'react-native'
import { type HeatLevel } from '@mydevtime/design'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'
import type { Theme } from '@mydevtime/design'
import type { YearMonth } from '../../planner/calendarMonth'

/**
 * Planner **Year** view — unified with the month heatmap (issue #367, ADR-0075). Twelve
 * month cards, each with its planned hours, a five-row week-intensity strip, and an event
 * count kept visually apart from work (events never count).
 *
 * What changed: the current month wears an **accent ring** (border), not a `live` orange
 * "NOW" border — `live` orange is reserved strictly for "happening now" (running timer,
 * now-line) per the palette rule (ADR-0075 corrects the old decorative misuse). The "NOW"
 * label is accent-colored. The week-intensity strip now uses the **same 5-step accent heat
 * scale** as the month view (the shared `HEAT_FILL` mapping, driven by `loadHeat`'s
 * `HeatLevel`), so the two views read as one surface. All figures are real
 * (`buildYearMonths`); an empty month reads "—" hours and an all-idle strip. Tapping a
 * month drills into it. Deterministic — no violet, no AI signature here.
 */
export interface PlannerYearProps {
  readonly months: readonly YearMonth[]
  readonly onDrill?: (month0: number) => void
}

/** The shared 5-step accent heat fill — the same scale the month view uses (issue #367). */
const HEAT_FILL: Record<HeatLevel, (t: Theme) => string> = {
  0: () => 'transparent',
  1: t => t.color.sunk,
  2: t => t.color.accentSoft,
  3: t => t.color.accentText,
  4: t => t.color.accent,
}

export function PlannerYear({ months, onDrill }: PlannerYearProps): React.JSX.Element {
  const t = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: t.spacing.s3,
        paddingVertical: t.spacing.s3,
      }}
    >
      {months.map(m => (
        <Pressable
          key={m.month0}
          accessibilityRole="button"
          accessibilityLabel={`${m.name} — ${m.hours > 0 ? `${String(m.hours)} hours` : 'no hours'}`}
          onPress={() => onDrill?.(m.month0)}
          style={{
            width: 150,
            flexGrow: 1,
            padding: t.spacing.s3,
            borderRadius: t.radius.card,
            // ADR-0075: the current month wears an accent ring, not a live-orange border.
            borderWidth: m.isNow ? 1.5 : 1,
            borderColor: m.isNow ? t.color.accent : t.color.border,
            backgroundColor: t.color.surface,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
            <Text
              style={{
                fontSize: t.fontSize.sm,
                fontWeight: '700',
                // The current month's name is accent-colored (not live orange).
                color: m.isNow ? t.color.accentText : t.color.ink,
              }}
            >
              {m.name}
            </Text>
            {m.isNow && (
              <Text
                style={{
                  fontSize: 8.5,
                  fontWeight: '800',
                  // ADR-0075: the NOW label is accent-colored, not live orange.
                  color: t.color.accent,
                  letterSpacing: 0.6,
                }}
              >
                NOW
              </Text>
            )}
            <Text
              style={{
                marginLeft: 'auto',
                fontFamily: t.fontFamily.numeric,
                fontSize: 10,
                color: t.color.ink3,
              }}
            >
              {m.hours > 0 ? `${String(m.hours)}h` : '—'}
            </Text>
          </View>

          {/* Week-intensity strip: five rows, unified with the month's 5-step heat scale. */}
          <View style={{ gap: 3 }}>
            {m.weekLoads.map((level, wi) => (
              <View
                key={wi}
                style={{
                  height: 6,
                  borderRadius: 2,
                  backgroundColor: HEAT_FILL[level as HeatLevel](t),
                }}
              />
            ))}
          </View>

          {/* Events — kept apart from work */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginTop: 10,
              minHeight: 12,
            }}
          >
            {m.eventCount > 0 && (
              <Text style={{ fontSize: 9, fontStyle: 'italic', color: t.color.ink3 }}>
                {m.eventCount} event{m.eventCount > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  )
}
