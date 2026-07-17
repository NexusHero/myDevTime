import type { BookedSpan } from '@mydevtime/domain'
import { apiBaseUrl } from '../config.js'
import { entryDurationMs, listEntries, type TimeEntry } from '../api/timer.js'
import { localDayKey } from '../autotracker/dayActivityStore.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * Today's booked time entries (REQ-004 / REQ-063). When an API base URL is configured the hook
 * lists the workspace entries and keeps the ones that **started today** (same local-day key the
 * auto-tracker's reality history uses, so the two align); otherwise — the default in local dev
 * and the test gate — it resolves **empty**. The app fabricates no entries.
 *
 * It also derives what the Feierabend / shutdown card (§K5) needs: the entries as booked
 * intervals (a running entry ends at `now`) and today's total booked ms. `live` flags that the
 * data is API-backed; screens get loading / error / retry for free from `useAsync`.
 */
export interface TodayEntriesResource extends AsyncResource<TimeEntry[]> {
  readonly live: boolean
  /** Today's entries as booked intervals (for the unbooked-stretch subtraction). */
  readonly booked: readonly BookedSpan[]
  /** Today's total booked time in ms (running entries count up to `now`). */
  readonly bookedMs: number
}

export function useTodayEntries(): TodayEntriesResource {
  const base = apiBaseUrl
  const now = new Date()
  const today = localDayKey(now.getTime())
  const resource = useAsync<TimeEntry[]>(
    () =>
      base !== null
        ? listEntries(base).then(rows =>
            rows.filter(e => localDayKey(Date.parse(e.startedAt)) === today),
          )
        : Promise.resolve<TimeEntry[]>([]),
    `today-entries:${base ?? 'empty'}:${today}`,
  )
  const entries = resource.data ?? []
  const closedEntries = entries.filter(e => e.endedAt !== null)
  const booked: readonly BookedSpan[] = closedEntries
    .map(e => ({
      startMs: Date.parse(e.startedAt),
      endMs: Date.parse(e.endedAt as string),
    }))
    .filter(b => Number.isFinite(b.startMs) && b.endMs > b.startMs)
  const bookedMs = closedEntries.reduce((n, e) => n + entryDurationMs(e, now), 0)
  return { ...resource, live: base !== null, booked, bookedMs }
}
