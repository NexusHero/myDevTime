import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'
import type { Theme } from '@mydevtime/design'
import type { YearMonth } from '../../planner/calendarMonth'

/**
 * Planner **Year** view (design v18 PlannerViews). Twelve month cards, each with its planned hours,
 * a five-row week-intensity strip (idle → heavy, `--accent` tints), and an event count kept visually
 * apart from work (events never count). The current month wears a live-orange border. All figures are
 * real (`buildYearMonths`); an empty month reads "—" hours and an all-idle strip. Tapping a month
 * drills into it. Deterministic — no violet, no AI signature here.
 */
export interface PlannerYearProps {
  readonly months: readonly YearMonth[]
  readonly onDrill?: (month0: number) => void
}

/** Intensity level 0–3 → a token color: idle sunk, then accent tints. */
function heat(t: Theme, level: number): string {
  switch (level) {
    case 1:
      return t.color.accentSoft
    case 2:
      return t.color.accentText
    case 3:
      return t.color.accent
    default:
      return t.color.sunk
  }
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
            borderWidth: m.isNow ? 1.5 : 1,
            borderColor: m.isNow ? t.color.live : t.color.border,
            backgroundColor: t.color.surface,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
            <Text
              style={{
                fontSize: t.fontSize.sm,
                fontWeight: '700',
                color: m.isNow ? t.color.live : t.color.ink,
              }}
            >
              {m.name}
            </Text>
            {m.isNow && (
              <Text
                style={{
                  fontSize: 8.5,
                  fontWeight: '800',
                  color: t.color.live,
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

          {/* Week-intensity strip: five rows */}
          <View style={{ gap: 3 }}>
            {m.weekLoads.map((level, wi) => (
              <View
                key={wi}
                style={{ height: 6, borderRadius: 2, backgroundColor: heat(t, level) }}
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
