import { estimateFromHistory } from '@mydevtime/domain'
import { formatDuration, formatMoneyMinor } from '@mydevtime/design'

/**
 * Build the grounded facts for the AI quote card (REQ-053/054, design v13 KI2) from a
 * project's own task-duration history. The distribution + buffered suggestion are the
 * deterministic `estimateFromHistory` core's (ADR-0005); this only turns them into the
 * fact strings the grounded LLM phrases. Returns an empty list when there is no usable
 * history, so the card stays hidden rather than inviting an ungrounded guess.
 */
export function quoteFacts(
  durationsMs: readonly number[],
  opts: { ratePerHourMinor: number; currency: string },
): string[] {
  const est = estimateFromHistory(durationsMs, { ratePerHourMinor: opts.ratePerHourMinor })
  if (est === null) return []
  const facts = [
    `Based on ${String(est.sampleSize)} past task(s) on this project: median ${formatDuration(est.medianMs)} h, typical range ${formatDuration(est.p25Ms)}–${formatDuration(est.p75Ms)} h, up to ${formatDuration(est.p90Ms)} h.`,
    `A buffered estimate (75th percentile) is ${formatDuration(est.suggestedMs)} h.`,
  ]
  if (est.suggestedMinor !== null) {
    facts.push(
      `At this project's rate that is about ${formatMoneyMinor(est.suggestedMinor, opts.currency)}.`,
    )
  }
  return facts
}
