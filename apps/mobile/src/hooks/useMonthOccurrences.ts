import { apiBaseUrl } from '../config.js'
import { listOccurrences, type Occurrence } from '../api/recurrence.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * The recurring-series occurrences for a whole month/year window (REQ-060, design v18 PlannerViews).
 * Like `useWeekOccurrences` but over a wider `[from, to]` span, so the Planner Month and Year views
 * render real projected work. When an API base URL is configured it projects from the `recurrence`
 * endpoint (the server runs the deterministic core); otherwise — local dev / the test gate — it
 * resolves **empty**, so the calendar shows an honest empty grid. `live` flags API-backed data.
 */
export interface MonthOccurrencesResource extends AsyncResource<Occurrence[]> {
  readonly live: boolean
}

/** `from`/`to` are `YYYY-MM-DD` bounds (inclusive); an empty bound skips the fetch. */
export function useMonthOccurrences(from: string, to: string): MonthOccurrencesResource {
  const base = apiBaseUrl
  const resource = useAsync<Occurrence[]>(
    () =>
      base !== null && from !== '' && to !== ''
        ? listOccurrences(base, { from, to })
        : Promise.resolve<Occurrence[]>([]),
    `month-occurrences:${base ?? 'empty'}:${from}:${to}`,
  )
  return { ...resource, live: base !== null }
}
