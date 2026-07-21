import { View } from 'react-native'
import { formatDuration } from '@mydevtime/design'
import { Text } from '../core/Text'
import { Button } from '../core/Button'
import { useTheme } from '../../theme/ThemeProvider'
import { pick } from '../../i18n/strings.js'

/**
 * The "Fülle meine Woche" review sheet (REQ-073, ADR-0072 D2): `packWeek`'s whole result as
 * **ghost** rows — dashed proposal styling, grouped by day — plus the capacity-honest
 * unplaced notice ("n passen diese Woche nicht" — shown, never hidden). Purely
 * presentational: ONE Confirm hands the whole ghost week back to the caller (which posts it
 * through the plan-apply seam, provenance `planner-fill`); Dismiss only tells the caller to
 * drop the preview — nothing else happens, nothing is written (ADR-0005: a proposal the user
 * declined leaves no trace).
 */
export interface FillWeekGhost {
  /** The `YYYY-MM-DD` day key. */
  readonly day: string
  /** Short display label for the day (deterministic, e.g. `21.07.`). */
  readonly dayLabel: string
  /** Minute of day. */
  readonly startMin: number
  readonly lenMin: number
  readonly title: string
}

export interface FillWeekPreviewProps {
  readonly ghosts: readonly FillWeekGhost[]
  /** How many rail items did not fit the week — the honest remainder. */
  readonly unplacedCount: number
  readonly busy: boolean
  readonly onConfirm: () => void
  readonly onDismiss: () => void
}

/** `HH:MM` from a minute-of-day. */
function clock(minOfDay: number): string {
  const h = String(Math.floor(minOfDay / 60)).padStart(2, '0')
  const m = String(minOfDay % 60).padStart(2, '0')
  return `${h}:${m}`
}

export function FillWeekPreview({
  ghosts,
  unplacedCount,
  busy,
  onConfirm,
  onDismiss,
}: FillWeekPreviewProps): React.JSX.Element {
  const t = useTheme()

  return (
    <View
      accessibilityLabel={pick('Fill-week proposal', 'Wochenfüllung-Vorschlag')}
      style={{
        gap: t.spacing.s3,
        padding: t.spacing.s4,
        borderRadius: t.radius.card,
        borderWidth: 1,
        borderColor: t.color.border,
        backgroundColor: t.color.surface,
      }}
    >
      <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink }}>
        {pick('Proposed week', 'Vorgeschlagene Woche')}
      </Text>
      <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
        {pick(
          'Ghost blocks — nothing is booked until you confirm.',
          'Ghost-Blöcke — nichts wird gebucht, bis du bestätigst.',
        )}
      </Text>

      {ghosts.length === 0 ? (
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
          {pick('Nothing fits this week.', 'Nichts passt in diese Woche.')}
        </Text>
      ) : (
        <View style={{ gap: t.spacing.s1 }}>
          {ghosts.map((g, i) => (
            <View
              key={`${g.day}-${String(g.startMin)}-${String(i)}`}
              accessibilityLabel={`${pick('Ghost', 'Ghost')}: ${g.title} ${g.dayLabel} ${clock(g.startMin)}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.s2,
                paddingVertical: 4,
                paddingHorizontal: t.spacing.s2,
                borderRadius: t.radius.block,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: t.color.borderStrong,
              }}
            >
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize['2xs'],
                  color: t.color.ink2,
                }}
              >
                {`${g.dayLabel} ${clock(g.startMin)}–${clock(g.startMin + g.lenMin)}`}
              </Text>
              <Text
                numberOfLines={1}
                style={{ flex: 1, fontSize: t.fontSize.xs, color: t.color.ink }}
              >
                {g.title}
              </Text>
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize['2xs'],
                  color: t.color.ink3,
                }}
              >
                {`${formatDuration(g.lenMin * 60_000)} h`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {unplacedCount > 0 && (
        <Text
          accessibilityRole="alert"
          style={{ fontSize: t.fontSize.xs, fontWeight: '600', color: t.color.warn }}
        >
          {unplacedCount === 1
            ? pick("1 doesn't fit this week", '1 passt diese Woche nicht')
            : pick(
                `${String(unplacedCount)} don't fit this week`,
                `${String(unplacedCount)} passen diese Woche nicht`,
              )}
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
        <Button size="sm" disabled={busy || ghosts.length === 0} onPress={onConfirm}>
          {busy ? pick('Booking…', 'Wird gebucht…') : pick('Confirm plan', 'Plan bestätigen')}
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onPress={onDismiss}>
          {pick('Dismiss', 'Verwerfen')}
        </Button>
      </View>
    </View>
  )
}
