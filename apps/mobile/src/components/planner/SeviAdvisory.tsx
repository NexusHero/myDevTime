import { useState } from 'react'
import { ContextBanner, type ContextBannerAction } from './ContextBanner.js'
import { useToast } from '../core/Toast.js'
import { pick } from '../../i18n/strings.js'
import {
  usePlanAdvisory,
  type PlanAdvisoryInput,
  type ReliefOption,
} from '../../hooks/usePlanAdvisory.js'

/**
 * Sevi as Scrum-Master at planning time (REQ-070, ADR-0071): ONE calm banner on the week
 * canvas when the planned load exceeds the honest plannable capacity — "only 24 h plannable,
 * 31 h planned — +7 h". Every figure is the deterministic core's (`commitmentAdvisory`,
 * ADR-0005); the relief actions are proposals and NOTHING mutates until the explicit
 * two-step confirm (pick a candidate → Confirm), which routes through the one plan-apply
 * seam. Within-capacity weeks render nothing at all — a buddy never nags. Rendered through
 * the existing `ContextBanner` (its `accessibilityRole="alert"` puts the overage figure in
 * the accessible name). After a confirmed apply the existing toast acknowledges it; an Undo
 * action would re-apply the inverse through the seam, but no proposal this mapping emits is
 * seam-invertible today (see `usePlanAdvisory`'s header), so the toast stands alone.
 */
export function SeviAdvisory(props: PlanAdvisoryInput): React.JSX.Element | null {
  const resource = usePlanAdvisory(props)
  const toast = useToast()
  const [pending, setPending] = useState<ReliefOption | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const { level, plannableMs, plannedMs, options, busy, confirm } = resource

  // Hidden entirely when the plan fits — no banner, no nag (REQ-070 acceptance).
  if (level === 'within' || dismissed) return null

  const h = (ms: number): string => (ms / 3_600_000).toFixed(1)
  const overMs = Math.max(0, plannedMs - plannableMs)
  const title = pick(
    `Only ${h(plannableMs)} h plannable, ${h(plannedMs)} h planned — +${h(overMs)} h`,
    `Nur ${h(plannableMs)} h planbar, ${h(plannedMs)} h geplant — +${h(overMs)} h`,
  )

  const optionLabel = (o: ReliefOption): string =>
    o.action === 'shrink'
      ? pick(
          `Shrink "${o.title}" by ${String(o.freedMin)} min`,
          `„${o.title}“ um ${String(o.freedMin)} min kürzen`,
        )
      : pick(`Protect "${o.title}"`, `„${o.title}“ schützen`)

  const applyPending = (option: ReliefOption): void => {
    void confirm(option).then(ok => {
      setPending(null)
      toast.show(
        ok
          ? pick(`Applied — ${optionLabel(option)}.`, `Übernommen — ${optionLabel(option)}.`)
          : pick(
              'Could not apply the change — please try again.',
              'Änderung konnte nicht übernommen werden — bitte erneut versuchen.',
            ),
      )
    })
  }

  // Two-step confirm: picking a candidate only ARMS it; the mutation happens exclusively
  // on the explicit Confirm tap (ADR-0005 — Sevi proposes, the user decides).
  const actions: readonly ContextBannerAction[] =
    pending === null
      ? [
          ...options.slice(0, 2).map(o => ({
            label: optionLabel(o),
            onPress: () => setPending(o),
            variant: 'ghost' as const,
          })),
          {
            label: pick('Later', 'Später'),
            onPress: () => setDismissed(true),
            variant: 'ghost' as const,
          },
        ]
      : [
          {
            label: busy ? '…' : pick('Confirm', 'Bestätigen'),
            onPress: () => {
              if (!busy) applyPending(pending)
            },
            variant: 'primary' as const,
          },
          {
            label: pick('Cancel', 'Abbrechen'),
            onPress: () => setPending(null),
            variant: 'ghost' as const,
          },
        ]

  const body =
    pending === null
      ? pick(
          'This week holds more than it can carry. One of these would ease it — nothing changes without your confirm.',
          'Diese Woche trägt mehr, als sie fassen kann. Eines davon würde entlasten — ohne deine Bestätigung ändert sich nichts.',
        )
      : optionLabel(pending)

  return (
    <ContextBanner
      variant={level === 'over' ? 'conflict' : 'note'}
      leadGlyph="✦"
      title={title}
      body={body}
      actions={actions}
    />
  )
}
