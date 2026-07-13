import { apiBaseUrl } from '../config.js'
import { listEntries, type TimeEntry } from '../api/timer.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * A task's time entries (REQ-004): when an API base URL is configured the hook
 * lists the workspace entries and keeps the ones for this task; otherwise — the
 * default in local dev and the test gate — it resolves illustrative demo entries
 * so the Task screen still reads. `live` lets the UI flag demo data. Screens get
 * loading / error / retry for free from `useAsync`.
 */
export interface TaskEntriesResource extends AsyncResource<TimeEntry[]> {
  readonly live: boolean
}

/** Illustrative entries shown when no backend is configured. */
function demoEntries(taskId: string): TimeEntry[] {
  const row = (id: string, startedAt: string, endedAt: string, source: string): TimeEntry => ({
    id,
    projectId: null,
    taskId,
    startedAt,
    endedAt,
    billable: true,
    source,
    note: null,
  })
  return [
    row('e1', '2026-07-10T09:30:00.000Z', '2026-07-10T11:00:00.000Z', 'timer'), // 1:30
    row('e2', '2026-07-09T14:10:00.000Z', '2026-07-09T16:25:00.000Z', 'timer'), // 2:15
    row('e3', '2026-07-09T11:00:00.000Z', '2026-07-09T11:45:00.000Z', 'calendar'), // 0:45
    row('e4', '2026-07-07T16:20:00.000Z', '2026-07-07T16:50:00.000Z', 'manual'), // 0:30
  ]
}

export function useTaskEntries(taskId: string): TaskEntriesResource {
  const base = apiBaseUrl
  const resource = useAsync<TimeEntry[]>(
    () => {
      if (base !== null) {
        return listEntries(base).then(rows => rows.filter(e => e.taskId === taskId))
      }
      return Promise.resolve(demoEntries(taskId))
    },
    `${base ?? 'demo'}:${taskId}`,
  )
  return { ...resource, live: base !== null }
}
