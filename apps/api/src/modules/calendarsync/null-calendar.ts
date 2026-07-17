import { CalendarUnavailableError, type CalendarPort, type CalendarRange } from './port.js'
import type { ExternalEvent } from '@mydevtime/domain'

/**
 * The graceful-degradation default (REQ-064, mirrors ADR-0029's `NullLlm`): the `CalendarPort`
 * used when no calendar provider is connected/consented or none is reachable. `available()` is
 * always false and `fetchEvents()` refuses with `CalendarUnavailableError`, so the import flow
 * falls back to its non-sync path and the deterministic core is untouched (ADR-0005). It is also
 * the seam the merge/import features test against before any live Google/Apple adapter exists
 * (those are gated on their integration spike).
 */
export class NullCalendar implements CalendarPort {
  readonly provider = 'null' as const

  fetchEvents(_range: CalendarRange): Promise<readonly ExternalEvent[]> {
    return Promise.reject(new CalendarUnavailableError('null', 'no calendar provider configured'))
  }

  available(): Promise<boolean> {
    return Promise.resolve(false)
  }
}
