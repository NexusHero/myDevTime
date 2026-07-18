import { Pressable, View } from 'react-native'
import { formatDuration } from '@mydevtime/design'
import { Text } from '../core/Text'
import { EmptyState } from '../index'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * The classic day **list** (design v13 §K, REQ-040): the same day the canvas shows, as a flat,
 * accessibility-first list — one row per entry (type dot · title · time span · duration), a day
 * subtotal, and full action parity with the canvas (tapping a row opens the same typed drawer).
 * It is the Canvas ⇄ List alternative for people who want a screen-reader-friendly, scannable day
 * without the geometry. Purely presentational: it renders exactly the entries the Planner hands it
 * and computes the subtotal deterministically from their lengths (ADR-0005) — it invents nothing,
 * and an empty day reads as an honest empty state, never a fabricated row.
 */
export interface DayListItem {
  readonly key: string
  readonly label: string
  /** Pre-formatted span, e.g. `09:00–10:30`. */
  readonly timeLabel: string
  /** Length in minutes — the deterministic input to the day subtotal. */
  readonly lenMin: number
  /** Resolved entry colour (project colour, break/life neutral, …). */
  readonly color: string
  /** Human kind label, e.g. `Meeting` / `Booked time`. */
  readonly typeLabel: string
  /** Open the entry's drawer (canvas parity); omitted for read-only recurring ghosts. */
  readonly onOpen?: () => void
}

export interface PlannerDayListProps {
  readonly items: readonly DayListItem[]
}

export function PlannerDayList({ items }: PlannerDayListProps): React.JSX.Element {
  const t = useTheme()

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing booked yet"
        hint="Entries you add to this day show up here — as a list, not a canvas."
      />
    )
  }

  const subtotalMin = items.reduce((sum, it) => sum + Math.max(it.lenMin, 0), 0)

  return (
    <View
      accessibilityLabel="Day list"
      style={{
        borderWidth: 1,
        borderColor: t.color.border,
        borderRadius: t.radius.card,
        overflow: 'hidden',
      }}
    >
      {items.map((it, i) => {
        const row = (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.s3,
              paddingHorizontal: t.spacing.s4,
              paddingVertical: t.spacing.s3,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: t.color.border,
            }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: it.color }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: t.color.ink }}
              >
                {it.label}
              </Text>
              <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
                {`${it.typeLabel} · ${it.timeLabel}`}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize.xs,
                color: t.color.ink2,
              }}
            >
              {`${formatDuration(it.lenMin * 60_000)} h`}
            </Text>
          </View>
        )
        return it.onOpen ? (
          <Pressable
            key={it.key}
            onPress={it.onOpen}
            accessibilityRole="button"
            accessibilityLabel={`${it.label}, ${it.typeLabel}, ${it.timeLabel}`}
          >
            {row}
          </Pressable>
        ) : (
          <View key={it.key}>{row}</View>
        )
      })}
      {/* Day subtotal — the deterministic sum of the listed entries' lengths. */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: t.spacing.s4,
          paddingVertical: t.spacing.s3,
          borderTopWidth: 1,
          borderTopColor: t.color.border,
          backgroundColor: t.color.sunk,
        }}
      >
        <Text style={{ fontSize: t.fontSize.xs, fontWeight: '700', color: t.color.ink2 }}>
          Day total
        </Text>
        <Text
          style={{
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize.sm,
            fontWeight: '700',
            color: t.color.ink,
          }}
        >
          {`${formatDuration(subtotalMin * 60_000)} h`}
        </Text>
      </View>
    </View>
  )
}
