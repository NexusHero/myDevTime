import { apiBaseUrl } from '../config.js'
import { getPlan, type DayPlan } from '../api/planner.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * The **accepted** day plans of the shown Planner week (ADR-0072 D3, REQ-074):
 * the calm canvas's default layer is exactly this — the accepted plan + the
 * now-line, nothing else. One latest-version read per visible day
 * (`GET /api/planner/plans?date=…`); only `status === 'accepted'` rows survive,
 * so a merely proposed plan never renders as if it were booked (ADR-0005/0071 —
 * ghosts are a chip layer, not the default). Without an API the hook resolves
 * all-null, an honestly empty week.
 */
export interface WeekPlansResource extends AsyncResource<readonly (DayPlan | null)[]> {
  readonly live: boolean
}

/** `weekDates` are the shown week's `YYYY-MM-DD` day keys in column order. */
export function useWeekPlans(weekDates: readonly string[]): WeekPlansResource {
  const base = apiBaseUrl
  const key = weekDates.join(',')
  const resource = useAsync<readonly (DayPlan | null)[]>(
    () =>
      base !== null && weekDates.length > 0
        ? Promise.all(
            weekDates.map(date =>
              getPlan(base, date).then(plan =>
                plan !== null && plan.status === 'accepted' ? plan : null,
              ),
            ),
          )
        : Promise.resolve(weekDates.map(() => null)),
    `week-plans:${base ?? 'empty'}:${key}`,
  )
  return { ...resource, live: base !== null }
}
