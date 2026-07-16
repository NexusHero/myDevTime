import { getJson, postJson } from './http.js'
import { nullableStr, parseArray, str } from './parse.js'
import type { Client, Project, Task } from '../screens/projectsData'

/**
 * The tracking read model for the client (issue #11): parse the catalog the
 * NestJS `tracking` module returns (`/api/tracking/{clients,projects,tasks}`) and
 * assemble it into the clients → projects → tasks tree the Projects screen renders.
 * `assembleCatalog` and the DTO parsers are pure and tested; the catalog carries
 * structure + rates, while budget/spent figures come from the billing/aggregation
 * endpoints in a later slice (so those read `0` here and the screen degrades).
 */
export interface ClientDTO {
  readonly id: string
  readonly name: string
}
export interface ProjectDTO {
  readonly id: string
  readonly name: string
  readonly clientId: string | null
  readonly hourlyRateOverride: string | null
}
export interface TaskDTO {
  readonly id: string
  readonly name: string
  readonly projectId: string
  readonly archived: boolean
}

export function parseClients(value: unknown): ClientDTO[] {
  return parseArray(value, o => ({ id: str(o, 'id'), name: str(o, 'name') }))
}
export function parseProjects(value: unknown): ProjectDTO[] {
  return parseArray(value, o => ({
    id: str(o, 'id'),
    name: str(o, 'name'),
    clientId: nullableStr(o, 'clientId'),
    hourlyRateOverride: nullableStr(o, 'hourlyRateOverride'),
  }))
}
export function parseTasks(value: unknown): TaskDTO[] {
  return parseArray(value, o => ({
    id: str(o, 'id'),
    name: str(o, 'name'),
    projectId: str(o, 'projectId'),
    archived: o.archived === true,
  }))
}

/** Parse a single project row (the create-project response). */
export function parseProject(value: unknown): ProjectDTO {
  const [project] = parseProjects([value])
  if (!project) throw new Error('parseProject: malformed project response')
  return project
}

/** A project to create; `name` is required, `color` optional (REQ-001). */
export interface NewProject {
  readonly name: string
  readonly color?: string | null
}

/**
 * Create a project and return the persisted row (REQ-001). Used by onboarding to
 * persist the projects the user creates there, so they land in the workspace
 * instead of being discarded (REQ-044, fixes audit H8).
 */
export async function createProject(
  baseUrl: string,
  input: NewProject,
  fetchImpl: typeof fetch = fetch,
): Promise<ProjectDTO> {
  return parseProject(await postJson(baseUrl, '/api/tracking/projects', input, fetchImpl))
}

const UNASSIGNED_ID = '__unassigned__'

/**
 * Build the Projects tree from the flat catalog lists. Projects group under their
 * client (or a synthetic "No client" bucket when `clientId` is null); tasks group
 * under their project. Budget/spent are `0` (not part of the catalog yet); the
 * hourly rate comes from the project's override when set.
 */
export function assembleCatalog(
  clients: readonly ClientDTO[],
  projects: readonly ProjectDTO[],
  tasks: readonly TaskDTO[],
): Client[] {
  const tasksByProject = new Map<string, Task[]>()
  for (const task of tasks) {
    const list = tasksByProject.get(task.projectId) ?? []
    list.push({ id: task.id, name: task.name, spentMs: 0, done: task.archived })
    tasksByProject.set(task.projectId, list)
  }

  const projectsByClient = new Map<string, Project[]>()
  for (const p of projects) {
    const clientKey = p.clientId ?? UNASSIGNED_ID
    const rate = p.hourlyRateOverride === null ? 0 : Number.parseInt(p.hourlyRateOverride, 10)
    const project: Project = {
      id: p.id,
      name: p.name,
      budgetMs: 0,
      spentMs: 0,
      rateMinorPerHour: Number.isFinite(rate) ? rate : 0,
      currency: 'EUR',
      tasks: tasksByProject.get(p.id) ?? [],
    }
    const list = projectsByClient.get(clientKey) ?? []
    list.push(project)
    projectsByClient.set(clientKey, list)
  }

  const result: Client[] = clients
    .map(c => ({ id: c.id, name: c.name, projects: projectsByClient.get(c.id) ?? [] }))
    .filter(c => c.projects.length > 0)

  const orphans = projectsByClient.get(UNASSIGNED_ID)
  if (orphans && orphans.length > 0) {
    result.push({ id: UNASSIGNED_ID, name: 'No client', projects: orphans })
  }
  return result
}

/** Fetch and assemble the workspace catalog from the tracking API. */
export async function fetchCatalog(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Client[]> {
  const [clients, projects, tasks] = await Promise.all([
    getJson(baseUrl, '/api/tracking/clients', fetchImpl).then(parseClients),
    getJson(baseUrl, '/api/tracking/projects', fetchImpl).then(parseProjects),
    getJson(baseUrl, '/api/tracking/tasks', fetchImpl).then(parseTasks),
  ])
  return assembleCatalog(clients, projects, tasks)
}
