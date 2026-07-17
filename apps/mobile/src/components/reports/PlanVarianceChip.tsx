import { planVsRealized } from '@mydevtime/domain'
import { Badge } from '../index'

/**
 * The "Plan ±x%" chip (REQ-061, design v17 §K4): for a fixed-fee project, the calculated
 * (expected) revenue vs the realized revenue — a rounded, signed variance banded `under` / `on`
 * / `over` a tolerance. Every figure is the deterministic `planVsRealized` core's (ADR-0005); no
 * AI, no forecast. Realized over plan reads as a gentle warning (you've logged more value than
 * the fixed fee covers); under and on read calm.
 */
export interface PlanVarianceChipProps {
  /** The project's expected (fixed-fee) revenue, minor units. */
  readonly expectedMinor: number
  /** Realized revenue so far (priced billable time), minor units. */
  readonly realizedMinor: number
  /** Tolerance band around plan, percent (default 2). */
  readonly tolerancePct?: number
}

export function PlanVarianceChip({
  expectedMinor,
  realizedMinor,
  tolerancePct,
}: PlanVarianceChipProps): React.JSX.Element | null {
  // No expected revenue → nothing to compare against (not a fixed-fee project).
  if (!(expectedMinor > 0)) return null
  const v = planVsRealized(
    expectedMinor,
    realizedMinor,
    tolerancePct === undefined ? undefined : { tolerancePct },
  )
  const tone = v.status === 'over' ? 'warn' : v.status === 'under' ? 'neutral' : 'good'
  const label =
    v.status === 'on' || v.variancePct === null
      ? 'Plan on'
      : `Plan ${v.variancePct > 0 ? '+' : ''}${String(v.variancePct)}%`
  return <Badge tone={tone}>{label}</Badge>
}
