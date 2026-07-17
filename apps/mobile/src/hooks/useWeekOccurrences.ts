import { apiBaseUrl } from '../config.js'
import { listOccurrences, type Occurrence } from '../api/recurrence.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * The recurring-series occurrences for the shown Planner week (REQ-060, design v17 §F4). When an
 * API base URL is configured the hook projects the week's occurrences from the `recurrence`
 * endpoint (the server runs the deterministic core); otherwise — the default in local dev and
 * the test gate — it resolves **empty**, so the canvas shows only real blocks. `live` flags that
 * the data is API-backed; the caller places the occurrences with the pure `occurrencesToBlocks`.
 */
export interface WeekOccurrencesResource extends AsyncResource<Occurrence[]> {
  readonly live: boolean
}

/** `weekDates` are the seven `YYYY-MM-DD` day columns in order; empty → no fetch. */
export function useWeekOccurrences(weekDates: readonly string[]): WeekOccurrencesResource {
  const base = apiBaseUrl
  const from = weekDates[0] ?? ''
  const to = weekDates[weekDates.length - 1] ?? ''
  const resource = useAsync<Occurrence[]>(
    () =>
      base !== null && from !== '' && to !== ''
        ? listOccurrences(base, { from, to })
        : Promise.resolve<Occurrence[]>([]),
    `week-occurrences:${base ?? 'empty'}:${from}:${to}`,
  )
  return { ...resource, live: base !== null }
}
