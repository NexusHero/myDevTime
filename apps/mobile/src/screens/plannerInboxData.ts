import type { Priority } from '@mydevtime/design'

/**
 * Types + static config for the Planner **Task-Inbox** (design v6): assigned
 * Jira/Linear/GitHub tickets land here, not in the calendar. "Plan" drops the
 * ticket into the next free slot as a ghost (a proposal — ADR-0005). No live
 * connector feeds this yet, so `INBOX_TASKS` is empty and the rail shows its empty
 * state — real tickets arrive once a ticket connector (Profile → Integrations) is
 * connected. The projects/tags/sources/sorters below are the rail's static config.
 */

export type TaskSource = 'Jira' | 'Linear' | 'GitHub'
export type TaskTag = 'Bug' | 'Feature' | 'Review'

export interface InboxTask {
  readonly key: string
  readonly title: string
  /** Estimate in hours. */
  readonly est: number
  readonly prio: Priority
  readonly tag: TaskTag
  /** Index into `INBOX_PROJECTS`. */
  readonly project: number
  readonly src: TaskSource
  readonly desc: string
  readonly due?: string
  /** Days until due (for the deadline tone). */
  readonly dueIn?: number
}

export interface InboxProject {
  readonly name: string
  /** Project id → deterministic color (FNV-1a). */
  readonly id: string
}

// Honest placeholders until a live ticket connector is wired (Profile → Integrations).
// No real company names — the `id` fields are only deterministic color keys, never shown.
export const INBOX_PROJECTS: readonly InboxProject[] = [
  { name: 'Project 1', id: 'finanzo' },
  { name: 'Project 2', id: 'sync-engine' },
  { name: 'Project 3', id: 'nordwind' },
  { name: 'Project 4', id: 'reviews' },
]

export const INBOX_TASKS: readonly InboxTask[] = []

export const INBOX_TAGS: readonly (TaskTag | 'All')[] = ['All', 'Bug', 'Feature', 'Review']
export const INBOX_SOURCES: readonly (TaskSource | 'All')[] = ['All', 'Jira', 'Linear', 'GitHub']
export type InboxSort = 'prio' | 'due' | 'est' | 'src'

/** The sort comparators, deterministic with a stable priority tie-break. */
export const INBOX_SORTERS: Record<InboxSort, (a: InboxTask, b: InboxTask) => number> = {
  prio: (a, b) => a.prio - b.prio || b.est - a.est,
  due: (a, b) => (a.dueIn ?? 99) - (b.dueIn ?? 99) || a.prio - b.prio,
  est: (a, b) => b.est - a.est || a.prio - b.prio,
  src: (a, b) => a.src.localeCompare(b.src) || a.prio - b.prio,
}
