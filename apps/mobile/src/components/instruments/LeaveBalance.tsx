import { View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

interface LeaveBalanceProps {
  /** Annual entitlement in days. */
  readonly entitlement?: number
  /** Days already taken. */
  readonly taken?: number
  /** Days booked but still in the future. */
  readonly planned?: number
  /** Days carried over from last year (added to the entitlement). */
  readonly carryover?: number
  readonly label?: string
  readonly unit?: string
}

/**
 * Leave balance (design v3) — the vacation account at a glance: a big remaining
 * number (mono, tabular) over a **segmented** year bar (taken → planned →
 * remaining), each segment labeled. Days are discrete, so this is deliberately a
 * bar, never a ring. Planned days read as a soft, accent-outlined segment (the
 * design's hatch) since React Native has no repeating-gradient fill.
 */
export function LeaveBalance({
  entitlement = 30,
  taken = 0,
  planned = 0,
  carryover = 0,
  label = 'Urlaub',
  unit = 'Tage',
}: LeaveBalanceProps): React.JSX.Element {
  const t = useTheme()
  const total = entitlement + carryover
  const rest = Math.max(0, total - taken - planned)
  const pct = (n: number): `${number}%` => `${total > 0 ? (n / total) * 100 : 0}%`
  const mono = { fontFamily: t.fontFamily.numeric, fontWeight: '600' as const, color: t.color.ink }

  const legendSwatch = (bg: string, border?: string): React.JSX.Element => (
    <View
      style={{
        width: 9,
        height: 9,
        borderRadius: 3,
        backgroundColor: bg,
        ...(border ? { borderWidth: 1, borderColor: border } : {}),
      }}
    />
  )

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: t.spacing.s2,
          marginBottom: t.spacing.s3,
        }}
      >
        <Text style={{ ...mono, fontSize: t.fontSize['2xl'], lineHeight: t.fontSize['2xl'] }}>
          {String(rest)}
        </Text>
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
          {unit} {label} übrig
        </Text>
        {carryover > 0 && (
          <Text
            style={{
              marginLeft: 'auto',
              fontSize: t.fontSize['2xs'],
              fontFamily: t.fontFamily.numeric,
              color: t.color.ink3,
            }}
          >
            inkl. {String(carryover)} Übertrag
          </Text>
        )}
      </View>

      <View
        style={{
          flexDirection: 'row',
          height: 12,
          borderRadius: t.radius.pill,
          overflow: 'hidden',
          gap: 2,
          backgroundColor: t.color.sunk,
        }}
      >
        {taken > 0 && <View style={{ width: pct(taken), backgroundColor: t.color.accent }} />}
        {planned > 0 && (
          <View
            style={{
              width: pct(planned),
              backgroundColor: t.color.accentSoft,
              borderWidth: 1,
              borderColor: t.color.accent,
            }}
          />
        )}
        <View style={{ flex: 1 }} />
      </View>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: t.spacing.s4,
          marginTop: t.spacing.s2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {legendSwatch(t.color.accent)}
          <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>
            Genommen <Text style={{ ...mono, fontSize: t.fontSize['2xs'] }}>{String(taken)}</Text>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {legendSwatch(t.color.accentSoft, t.color.accent)}
          <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>
            Verplant <Text style={{ ...mono, fontSize: t.fontSize['2xs'] }}>{String(planned)}</Text>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {legendSwatch(t.color.sunk, t.color.borderStrong)}
          <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>
            Anspruch <Text style={{ ...mono, fontSize: t.fontSize['2xs'] }}>{String(total)}</Text>
          </Text>
        </View>
      </View>
    </View>
  )
}
