import { useState } from 'react'
import { View } from 'react-native'
import { Text } from '../core/Text'
import { Button } from '../core/Button'
import { useTheme } from '../../theme/ThemeProvider'
import { apiBaseUrl } from '../../config.js'
import { applyPlanProposal } from '../../api/planApply.js'
import { pick } from '../../i18n/strings.js'
import { useLifeCare, type LifeCareVoice } from '../../hooks/useLifeCare.js'

/**
 * Sevi's life-care voices on the Planner week (ADR-0071 P5, REQ-071). Calm and non-modal:
 * one quiet line per delivered suggestion — no free evening left · work over a life block ·
 * a rest day after a heavy run — each with exactly ONE explicit confirm that applies the
 * already-derived 🛡 protect-time proposal. Nothing ever auto-applies (ADR-0005), and when
 * `useLifeCare` delivers nothing (quiet week, opt-out, quiet hours, active 🛡, spent budget)
 * the card renders nothing at all — no teaser, no badge. Each row is an accessible `status`
 * region whose name carries the message (the acceptance spec locates it by exactly that).
 * Life care is care, never upsell: no credit or entitlement checks on any path (REQ-071).
 */
export interface LifeCareCardProps {
  /** The shown week's `YYYY-MM-DD` day columns, in order — the same list the canvas uses. */
  readonly weekDates: readonly string[]
}

export function LifeCareCard({ weekDates }: LifeCareCardProps): React.JSX.Element | null {
  const t = useTheme()
  const { suggestions } = useLifeCare(weekDates)
  const [appliedKinds, setAppliedKinds] = useState<readonly string[]>([])
  const [failedKinds, setFailedKinds] = useState<readonly string[]>([])
  const [busyKind, setBusyKind] = useState<string | null>(null)

  const base = apiBaseUrl
  if (base === null || suggestions.length === 0) return null

  const confirm = (voice: LifeCareVoice): void => {
    // One in-flight confirm at a time; an applied row loses its button entirely, so a
    // voice can never post its (idempotent) proposal twice from this mount.
    if (busyKind !== null) return
    setBusyKind(voice.kind)
    setFailedKinds(ks => ks.filter(k => k !== voice.kind))
    applyPlanProposal(base, voice.proposal)
      .then(() => {
        setAppliedKinds(ks => [...ks, voice.kind])
      })
      .catch(() => {
        setFailedKinds(ks => [...ks, voice.kind])
      })
      .finally(() => {
        setBusyKind(null)
      })
  }

  return (
    <View
      style={{
        gap: t.spacing.s2,
        paddingVertical: t.spacing.s2,
        paddingHorizontal: t.spacing.s3,
        borderRadius: t.radius.block,
        borderWidth: 1,
        borderColor: t.color.border,
        backgroundColor: t.color.surface,
        maxWidth: 680,
      }}
    >
      {suggestions.map(voice => {
        const applied = appliedKinds.includes(voice.kind)
        const failed = failedKinds.includes(voice.kind)
        return (
          <View
            key={voice.kind}
            role="status"
            accessibilityLabel={voice.message}
            style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}
          >
            <Text style={{ flex: 1, fontSize: t.fontSize.xs, color: t.color.ink2, lineHeight: 18 }}>
              {`🌿 ${voice.message}`}
            </Text>
            {applied ? (
              <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
                {pick('Protected.', 'Geschützt.')}
              </Text>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={busyKind !== null}
                onPress={() => {
                  confirm(voice)
                }}
              >
                {voice.confirmLabel}
              </Button>
            )}
            {failed && (
              <Text
                accessibilityRole="alert"
                style={{ fontSize: t.fontSize['2xs'], color: t.color.crit }}
              >
                {pick('Could not protect this time.', 'Die Zeit konnte nicht geschützt werden.')}
              </Text>
            )}
          </View>
        )
      })}
    </View>
  )
}
