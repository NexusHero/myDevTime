import { useCallback, useState } from 'react'
import { apiBaseUrl } from '../config.js'
import { getConnectors } from '../api/connectors.js'
import { previewIssueImport, type CandidateTaskProposal } from '../api/issues.js'
import { requestEstimate, type EstimateProposal } from '../api/estimate.js'
import { getJson } from '../api/http.js'
import { parseTasks, setTaskEstimate, type TaskDTO } from '../api/tracking.js'
import { useAsync } from './useAsync.js'

/**
 * The backlog-rail data source (REQ-073, ADR-0072 D2). Assembles the rail's items from the
 * two real backlog feeds:
 *
 * - **own open tasks** — the workspace task catalog (`GET /api/tracking/tasks`, REQ-001),
 *   minus archived ones, in the API's stable creation order;
 * - **imported issues** (ADR-0070, proposal-only as ever) — every *connected* issues
 *   connector's import preview; a refusing/unavailable connector contributes nothing (the
 *   rail keeps working — honest degrade, never a fake ticket).
 *
 * **Estimates (deterministic first, ADR-0005):** an item packs at its explicit
 * `estimateMinutes` when the task has one, else at the deterministic
 * {@link DEFAULT_ESTIMATE_MIN 60-minute default} (`estimateSource: 'default'`). The AI
 * estimation (REQ-041) only ever *refines* that as a visibly violet proposal the user must
 * accept — `requestRefinement` fetches the proposal, `acceptRefinement` persists it (tasks:
 * the ordinary `setTaskEstimate` PATCH; issue proposals: a local accepted override, they own
 * no task row yet) and the item list changes, which re-packs downstream. With the provider
 * down the endpoint degrades to a `deterministic` baseline that is NEVER shown violet, and
 * packing itself never waits on any of this.
 *
 * **Priority (deterministic, documented):** the rail is one stable queue — own tasks first
 * (catalog creation order: oldest commitment first), then issue proposals (the import
 * preview's deterministic order); `priority` is the 1-based position in that queue. Ties
 * cannot occur, reruns cannot reorder.
 */
export const DEFAULT_ESTIMATE_MIN = 60

export interface BacklogRailItem {
  /** Stable id: `task:<taskId>` or `issue:<connectorId>:<externalKey>`. */
  readonly id: string
  readonly title: string
  readonly estimateMin: number
  readonly estimateSource: 'explicit' | 'default'
  /** 1-based stable queue position — lower packs first. */
  readonly priority: number
  readonly origin: 'task' | 'issue'
  readonly projectId?: string
  /** Set for `task` items — the plan block's `taskId` and the estimate PATCH target. */
  readonly taskId?: string
}

export interface BacklogRailResource {
  readonly items: readonly BacklogRailItem[]
  readonly loading: boolean
  readonly error: Error | null
  readonly live: boolean
  readonly reload: () => void
  /** Un-accepted AI refinement proposals by item id — render violet ONLY for `ai-proposal`. */
  readonly proposals: Readonly<Record<string, EstimateProposal>>
  /** Item ids with a refinement request in flight. */
  readonly refining: readonly string[]
  readonly requestRefinement: (item: BacklogRailItem) => void
  /** Accept a reviewed proposal: persist the estimate, drop the proposal, reload the items. */
  readonly acceptRefinement: (item: BacklogRailItem) => void
}

/** Open (non-archived) workspace tasks in the API's stable order. */
async function loadOpenTasks(base: string): Promise<TaskDTO[]> {
  const tasks = parseTasks(await getJson(base, '/api/tracking/tasks'))
  return tasks.filter(t => !t.archived)
}

interface IssueEntry {
  readonly connectorId: string
  readonly proposal: CandidateTaskProposal
}

/** Every connected issues connector's preview, in connector order; failures contribute nothing. */
async function loadIssueProposals(base: string): Promise<IssueEntry[]> {
  const connectors = await getConnectors(base).catch(() => [])
  const issueConnectors = connectors.filter(c => c.category === 'issues' && c.connected)
  const entries: IssueEntry[] = []
  for (const connector of issueConnectors) {
    // A 409 (no consent / not connected) or outage yields nothing — never a fake ticket.
    const preview = await previewIssueImport(base, connector.id).catch(() => null)
    for (const proposal of preview?.proposals ?? []) {
      entries.push({ connectorId: connector.id, proposal })
    }
  }
  return entries
}

export function useBacklogRail(): BacklogRailResource {
  const base = apiBaseUrl
  const live = base !== null

  const tasks = useAsync<TaskDTO[]>(
    () => (base !== null ? loadOpenTasks(base) : Promise.resolve([])),
    `backlog-rail-tasks:${base ?? 'off'}`,
  )
  const issues = useAsync<IssueEntry[]>(
    () => (base !== null ? loadIssueProposals(base) : Promise.resolve([])),
    `backlog-rail-issues:${base ?? 'off'}`,
  )

  const [proposals, setProposals] = useState<Record<string, EstimateProposal>>({})
  const [refining, setRefining] = useState<readonly string[]>([])
  // Accepted refinements for issue proposals — they own no task row to PATCH yet, so the
  // accepted minutes live here and resolve exactly like an explicit estimate.
  const [issueEstimates, setIssueEstimates] = useState<Record<string, number>>({})

  const items: BacklogRailItem[] = []
  for (const task of tasks.data ?? []) {
    const explicit = task.estimateMinutes
    items.push({
      id: `task:${task.id}`,
      title: task.name,
      estimateMin: explicit ?? DEFAULT_ESTIMATE_MIN,
      estimateSource: explicit === null ? 'default' : 'explicit',
      priority: items.length + 1,
      origin: 'task',
      projectId: task.projectId,
      taskId: task.id,
    })
  }
  for (const { connectorId, proposal } of issues.data ?? []) {
    const id = `issue:${connectorId}:${proposal.externalKey}`
    const accepted = issueEstimates[id]
    items.push({
      id,
      title: proposal.title,
      estimateMin: accepted ?? DEFAULT_ESTIMATE_MIN,
      estimateSource: accepted === undefined ? 'default' : 'explicit',
      priority: items.length + 1,
      origin: 'issue',
    })
  }

  const reload = useCallback(() => {
    tasks.reload()
    issues.reload()
  }, [tasks.reload, issues.reload])

  const requestRefinement = useCallback(
    (item: BacklogRailItem) => {
      if (base === null) return
      setRefining(ids => (ids.includes(item.id) ? ids : [...ids, item.id]))
      // The estimator grounds on category/complexity where the task has them; the server
      // defaults the rest. A failure simply leaves the deterministic default standing.
      requestEstimate(base, { note: item.title })
        .then(proposal => {
          setProposals(p => ({ ...p, [item.id]: proposal }))
        })
        .catch(() => undefined)
        .finally(() => {
          setRefining(ids => ids.filter(id => id !== item.id))
        })
    },
    [base],
  )

  const acceptRefinement = useCallback(
    (item: BacklogRailItem) => {
      const proposal = proposals[item.id]
      if (proposal === undefined) return
      const minutes = proposal.estimateMinutes
      setProposals(p => {
        const { [item.id]: _dropped, ...rest } = p
        return rest
      })
      if (item.taskId !== undefined && base !== null) {
        // The ordinary REQ-041 apply path — the deterministic core persists the number.
        void setTaskEstimate(base, item.taskId, { estimateMinutes: minutes })
          .then(() => {
            tasks.reload()
          })
          .catch(() => undefined)
      } else {
        setIssueEstimates(m => ({ ...m, [item.id]: minutes }))
      }
    },
    [base, proposals, tasks.reload],
  )

  return {
    items,
    loading: tasks.loading || issues.loading,
    error: tasks.error ?? issues.error,
    live,
    reload,
    proposals,
    refining,
    requestRefinement,
    acceptRefinement,
  }
}
