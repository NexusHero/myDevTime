import {
  mergeCalendar,
  type ExternalEvent,
  type ImportedBlock,
  type MergeProposal,
} from '@mydevtime/domain'
import { CalendarUnavailableError, type CalendarPort, type CalendarRange } from './port.js'

/**
 * Calendar import planning (REQ-064, design v17 §F6): fetch a provider's events through the narrow
 * `CalendarPort` and diff them against what we already imported via the deterministic
 * `mergeCalendar` core (ADR-0005). The result is a **proposal** — ghost blocks to confirm — never
 * a write. Two hard gates come first: **consent** (no capture path without stored opt-in, REQ-025)
 * and **availability** (a down/unconfigured provider degrades to "nothing proposed", never throws
 * up the stack). Live Google/Apple adapters are spike-gated; the Null adapter exercises this seam.
 */

export interface ImportPlan {
  /** The deterministic diff, or an empty proposal when the provider is off/unconsented. */
  readonly proposal: MergeProposal
  /** Why the plan is empty, when it is — surfaced honestly to the caller. */
  readonly status: 'ok' | 'no-consent' | 'unavailable'
}

const EMPTY = (status: ImportPlan['status']): ImportPlan => ({
  proposal: { changes: [], orphaned: [], unchangedCount: 0 },
  status,
})

/**
 * Plan a calendar import: consent-gated, availability-gated, then a deterministic merge. Returns
 * proposals only — the caller books nothing until the user confirms a ghost block. A provider that
 * throws `CalendarUnavailableError` mid-fetch degrades to an empty `unavailable` plan (ADR-0005).
 */
export async function planImport(
  port: CalendarPort,
  imported: readonly ImportedBlock[],
  range: CalendarRange,
  consented: boolean,
): Promise<ImportPlan> {
  if (!consented) return EMPTY('no-consent')
  if (!(await port.available())) return EMPTY('unavailable')
  let external: readonly ExternalEvent[]
  try {
    external = await port.fetchEvents(range)
  } catch (err) {
    if (err instanceof CalendarUnavailableError) return EMPTY('unavailable')
    throw err
  }
  return { proposal: mergeCalendar(external, imported), status: 'ok' }
}
