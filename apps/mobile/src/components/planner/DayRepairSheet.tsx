import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'
import type { DayRepairResource } from '../../hooks/useDayRepair'

/**
 * One-tap day repair — chip + ghost preview (ADR-0072 D1, REQ-072, ux-vision §2.7). The drift
 * chip is the HANDLE, not just the indicator: `Plan gerissen · Reparieren` opens the repaired
 * remainder as dashed ghost placements (the calm-AI ghost styling), the stretch price is
 * stated BEFORE the confirm whenever the layout crosses the personal line, and moved blocks
 * are named — the repair tells the truth instead of hiding overflow. Confirm is the ONLY
 * mutation (the hook posts through the plan-apply seam); Dismiss closes the preview and
 * changes nothing. Self-contained: screens mount it with the hook's resource and, where an
 * existing chip is already the handle (Today), suppress the built-in chip via `chip={false}`.
 */
export function DayRepairSheet({
  repair,
  chip = true,
}: {
  readonly repair: DayRepairResource
  /** Render the built-in drift chip trigger (off when an existing chip is the handle). */
  readonly chip?: boolean
}): React.JSX.Element | null {
  const t = useTheme()
  if (repair.proposal === null) return null

  return (
    <View style={{ gap: t.spacing.s2 }}>
      {chip && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Plan gerissen · Reparieren"
          onPress={repair.openPreview}
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.s2,
            paddingHorizontal: t.spacing.s3,
            paddingVertical: 4,
            borderRadius: t.radius.pill,
            borderWidth: 1,
            borderColor: t.color.warn,
            backgroundColor: t.color.warnSoft,
          }}
        >
          <Text style={{ fontSize: t.fontSize.xs, fontWeight: '700', color: t.color.warn }}>
            Plan gerissen · Reparieren
          </Text>
        </Pressable>
      )}

      {repair.previewOpen && (
        <View
          accessibilityRole="summary"
          accessibilityLabel="Day repair proposal"
          style={{
            gap: t.spacing.s2,
            padding: t.spacing.s4,
            borderRadius: t.radius.card,
            borderWidth: 1,
            borderColor: t.color.border,
            backgroundColor: t.color.surface,
          }}
        >
          <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink }}>
            Repair the rest of the day
          </Text>
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
            A proposal — nothing moves without your tap.
          </Text>

          {/* Ghost preview: the re-laid placements, dashed like every Co-Planner ghost. */}
          <View style={{ gap: t.spacing.s2, marginTop: t.spacing.s1 }}>
            {repair.placements.map(p => (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.spacing.s3,
                  paddingHorizontal: t.spacing.s3,
                  paddingVertical: t.spacing.s2,
                  borderRadius: t.radius.block,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: t.color.ink3,
                }}
              >
                <Text
                  style={{
                    fontFamily: t.fontFamily.numeric,
                    fontSize: t.fontSize.xs,
                    color: t.color.ink2,
                  }}
                >
                  {p.timeLabel}
                </Text>
                <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink, flexShrink: 1 }}>
                  {p.label}
                </Text>
              </View>
            ))}
          </View>

          {/* The informed deal: the stretch price BEFORE the tap (issue-fixed copy). */}
          {repair.price !== null && (
            <Text
              accessibilityRole="alert"
              style={{ fontSize: t.fontSize.xs, fontWeight: '700', color: t.color.warn }}
            >
              {repair.price}
            </Text>
          )}

          {/* Honest overflow: work that leaves the day is named, never hidden. */}
          {repair.movedLabels.length > 0 && (
            <Text
              accessibilityRole="alert"
              style={{ fontSize: t.fontSize.xs, fontWeight: '700', color: t.color.warn }}
            >
              {`Doesn't fit today anymore → tomorrow/backlog: ${repair.movedLabels.join(', ')}`}
            </Text>
          )}

          {repair.error !== null && (
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.crit }}>
              {`Repair not applied — ${repair.error.message}`}
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: t.spacing.s1 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm repair"
              disabled={repair.applying}
              onPress={repair.apply}
              style={{
                paddingHorizontal: t.spacing.s4,
                paddingVertical: t.spacing.s2,
                borderRadius: t.radius.pill,
                backgroundColor: t.color.accent,
                opacity: repair.applying ? 0.5 : 1,
              }}
            >
              <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: '#ffffff' }}>
                {repair.applying ? 'Applying…' : 'Confirm repair'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss repair"
              onPress={repair.dismiss}
              style={{
                paddingHorizontal: t.spacing.s4,
                paddingVertical: t.spacing.s2,
                borderRadius: t.radius.pill,
                borderWidth: 1,
                borderColor: t.color.border,
              }}
            >
              <Text style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: t.color.ink2 }}>
                Dismiss
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}
