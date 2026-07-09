/**
 * Illustrative catalog data (clients → projects → tasks) shared by the Projects
 * list and the project/task detail screens (issue #11), so a drill-down reads the
 * exact same source the list showed. This stands in until the tracking API /
 * sync slice feeds real data; the shapes mirror the `tracking` domain, and every
 * figure is a duration in milliseconds so the design `format*` helpers own the
 * rendering (ADR-0005).
 */
export interface Task {
  readonly id: string
  readonly name: string
  readonly spentMs: number
  readonly done?: boolean
}

export interface Project {
  readonly id: string
  readonly name: string
  readonly budgetMs: number
  readonly spentMs: number
  readonly rateMinorPerHour: number
  readonly currency: string
  readonly tasks: readonly Task[]
}

export interface Client {
  readonly id: string
  readonly name: string
  readonly projects: readonly Project[]
}

const H = 3_600_000

export const CLIENTS: readonly Client[] = [
  {
    id: 'nexushero',
    name: 'NexusHero',
    projects: [
      {
        id: 'finanzo',
        name: 'Finanzo',
        budgetMs: 120 * H,
        spentMs: 78 * H + 30 * 60_000,
        rateMinorPerHour: 12_000,
        currency: 'EUR',
        tasks: [
          { id: 'f1', name: 'Ledger domain core', spentMs: 22 * H, done: true },
          { id: 'f2', name: 'Reconciliation UI', spentMs: 31 * H + 30 * 60_000 },
          { id: 'f3', name: 'CSV import', spentMs: 25 * H },
        ],
      },
      {
        id: 'sync-engine',
        name: 'Sync engine',
        budgetMs: 60 * H,
        spentMs: 58 * H,
        rateMinorPerHour: 12_000,
        currency: 'EUR',
        tasks: [
          { id: 's1', name: 'CRDT resolve', spentMs: 34 * H, done: true },
          { id: 's2', name: 'Convergence sim', spentMs: 24 * H },
        ],
      },
    ],
  },
  {
    id: 'nordwind',
    name: 'Nordwind GmbH',
    projects: [
      {
        id: 'nordwind',
        name: 'Website relaunch',
        budgetMs: 40 * H,
        spentMs: 44 * H,
        rateMinorPerHour: 9_500,
        currency: 'EUR',
        tasks: [
          { id: 'n1', name: 'Design system', spentMs: 18 * H, done: true },
          { id: 'n2', name: 'CMS migration', spentMs: 26 * H },
        ],
      },
    ],
  },
]

export interface ProjectWithClient {
  readonly project: Project
  readonly client: Client
}

/** Locate a project (and its client) by id, or `null` when unknown. */
export function findProject(projectId: string): ProjectWithClient | null {
  for (const client of CLIENTS) {
    const project = client.projects.find(p => p.id === projectId)
    if (project) return { project, client }
  }
  return null
}

export interface TaskWithProject {
  readonly task: Task
  readonly project: Project
  readonly client: Client
}

/** Locate a task (and its project + client) by id, or `null` when unknown. */
export function findTask(taskId: string): TaskWithProject | null {
  for (const client of CLIENTS) {
    for (const project of client.projects) {
      const task = project.tasks.find(t => t.id === taskId)
      if (task) return { task, project, client }
    }
  }
  return null
}
