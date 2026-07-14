import { Pressable, View } from 'react-native'
import { projectColors, type Theme } from '@mydevtime/design'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'
import { FlagGlyph } from './FlagGlyph'
import { YEAR_MONTHS, type YearMonth } from '../../screens/plannerViewsData'

/**
 * Planner — **Jahr** facet (design v6): twelve month tiles, each a five-row week
 * intensity heat plus a work-free pennant row for its events. The current month
 * is ringed in `--live`. A tile drills into the month. Load intensity uses the
 * accent at four steps; events stay a separate violet pennant — never mixed with
 * the work heat (the same task/event ground law as the month grid).
 */

/** Accent heat ramp: level 0 (idle) → 3 (full), as alpha-stepped accent. */
function heatColor(t: Theme, level: number): string {
  const accent = t.color.accent
  switch (level) {
    case 1:
      return `${accent}40`
    case 2:
      return `${accent}8c`
    case 3:
      return accent
    default:
      return t.color.sunk
  }
}

function MonthTile({
  month,
  onDrill,
}: {
  readonly month: YearMonth
  readonly onDrill?: ((name: string) => void) | undefined
}): React.JSX.Element {
  const t = useTheme()
  const eventColor = projectColors[t.mode][1] ?? t.color.ink2
  return (
    <Pressable
      onPress={() => onDrill?.(month.name)}
      accessibilityRole="button"
      accessibilityLabel={month.name}
      style={{
        flexGrow: 1,
        flexBasis: 150,
        minWidth: 130,
        padding: 14,
        borderRadius: t.radius.card,
        borderWidth: month.now ? 1.5 : 1,
        borderColor: month.now ? t.color.live : t.color.border,
        backgroundColor: t.color.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
        <Text
          style={{
            fontFamily: t.fontFamily.display,
            fontWeight: '700',
            fontSize: t.fontSize.sm,
            color: month.now ? t.color.live : t.color.ink,
          }}
        >
          {month.name}
        </Text>
        {month.now && (
          <Text
            style={{
              fontSize: 8.5,
              fontWeight: '800',
              color: t.color.live,
              letterSpacing: 8.5 * t.letterSpacing.wide,
              textTransform: 'uppercase',
            }}
          >
            Jetzt
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
          {month.hours > 0 ? `${String(month.hours)}h` : '—'}
        </Text>
      </View>

      {/* Week intensity — five rows, one per week. */}
      <View style={{ gap: 3 }}>
        {month.weeks.map((level, wi) => (
          <View
            key={wi}
            style={{ height: 6, borderRadius: 2, backgroundColor: heatColor(t, level) }}
          />
        ))}
      </View>

      {/* Events as a pennant row — separate from the work heat. */}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, minHeight: 12 }}
      >
        {Array.from({ length: month.events }).map((_, i) => (
          <FlagGlyph key={i} color={eventColor} size={10} />
        ))}
        {month.events > 0 && (
          <Text style={{ fontSize: 9, fontStyle: 'italic', color: t.color.ink3 }}>
            {month.events} Event{month.events > 1 ? 's' : ''}
          </Text>
        )}
      </View>
    </Pressable>
  )
}

export function PlannerYearView({
  onDrill,
}: {
  readonly onDrill?: (name: string) => void
}): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s3 }}>
      {YEAR_MONTHS.map(m => (
        <MonthTile key={m.name} month={m} onDrill={onDrill} />
      ))}
    </View>
  )
}
