/**
 * The catalog shapes (clients → projects → tasks) shared by the Projects list and
 * the project/task detail screens (issue #11), so a drill-down reads the exact same
 * source the list showed. The data itself comes live from the tracking API
 * (`useCatalog`); these are just the types plus pure lookup helpers over a loaded
 * catalog. Every figure is a duration in milliseconds so the design `format*`
 * helpers own the rendering (ADR-0005).
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
  /** Fixed-fee / expected revenue in minor units (design v17 §K4); null = not a fixed-fee project. */
  readonly fixedFeeMinor?: number | null
}

export interface Client {
  readonly id: string
  readonly name: string
  readonly projects: readonly Project[]
}

export interface ProjectWithClient {
  readonly project: Project
  readonly client: Client
}

/** Locate a project (and its client) by id within a loaded catalog, or `null`. */
export function findProject(
  clients: readonly Client[],
  projectId: string,
): ProjectWithClient | null {
  for (const client of clients) {
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

/** Locate a task (and its project + client) by id within a loaded catalog, or `null`. */
export function findTask(clients: readonly Client[], taskId: string): TaskWithProject | null {
  for (const client of clients) {
    for (const project of client.projects) {
      const task = project.tasks.find(t => t.id === taskId)
      if (task) return { task, project, client }
    }
  }
  return null
}
