import { apiBaseUrl } from '../config.js'
import { listEntries, type TimeEntry } from '../api/timer.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * A task's time entries (REQ-004): when an API base URL is configured the hook
 * lists the workspace entries and keeps the ones for this task; otherwise — the
 * default in local dev and the test gate — it resolves **empty**. The app
 * fabricates no entries. `live` lets the UI flag that the data is API-backed;
 * screens get loading / error / retry for free from `useAsync`.
 */
export interface TaskEntriesResource extends AsyncResource<TimeEntry[]> {
  readonly live: boolean
}

export function useTaskEntries(taskId: string): TaskEntriesResource {
  const base = apiBaseUrl
  const resource = useAsync<TimeEntry[]>(
    () =>
      base !== null
        ? listEntries(base).then(rows => rows.filter(e => e.taskId === taskId))
        : Promise.resolve<TimeEntry[]>([]),
    `${base ?? 'empty'}:${taskId}`,
  )
  return { ...resource, live: base !== null }
}
