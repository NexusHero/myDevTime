import { apiBaseUrl } from '../config.js'
import { listEntries, type TimeEntry } from '../api/timer.js'
import { useAsync, type AsyncResource } from './useAsync.js'
import { useLocalDb } from '../localDb/LocalDbProvider.js'
import { listEntries as listLocalEntries } from '@mydevtime/local-db'

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


export function useTaskEntries(taskId: string): TaskEntriesResource {
  const base = apiBaseUrl
  const db = useLocalDb()
  const resource = useAsync<TimeEntry[]>(
    async () => {
      if (base === null) {
        const rows = await listLocalEntries(db)
        return rows.filter(e => e.taskId === taskId) as TimeEntry[]
      }
      const rows = await listEntries(base)
      return rows.filter(e => e.taskId === taskId)
    },
    `${base ?? 'demo'}:${taskId}`,
  )
  return { ...resource, live: base !== null }
}
