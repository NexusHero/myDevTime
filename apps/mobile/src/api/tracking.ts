import { getJson, patchJson, postJson } from './http.js'
import { z } from 'zod'
import type { Client, Project, Task } from '../screens/projectsData'

/**
 * The tracking read model for the client (issue #11): parse the catalog the
 * NestJS `tracking` module returns (`/api/tracking/{clients,projects,tasks}`) and
 * assemble it into the clients → projects → tasks tree the Projects screen renders.
 * `assembleCatalog` and the DTO parsers are pure and tested; the catalog carries
 * structure + rates, while budget/spent figures come from the billing/aggregation
 * endpoints in a later slice (so those read `0` here and the screen degrades).
 */
export const clientDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type ClientDTO = z.infer<typeof clientDtoSchema>

export const projectDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  clientId: z.string().nullable().catch(null).default(null),
  hourlyRateOverride: z.string().nullable().catch(null).default(null),
  fixedFeeMinor: z.number().nullable().catch(null).default(null),
})
export type ProjectDTO = z.infer<typeof projectDtoSchema>

export const taskDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  projectId: z.string(),
  archived: z.boolean().default(false),
  // Effort estimation (REQ-041) — tolerant nullable, like the project rate fields.
  category: z.string().nullable().catch(null).default(null),
  complexity: z.string().nullable().catch(null).default(null),
  estimateMinutes: z.number().nullable().catch(null).default(null),
})
export type TaskDTO = z.infer<typeof taskDtoSchema>

export function parseClients(value: unknown): ClientDTO[] {
  return z.array(clientDtoSchema).parse(value)
}
export function parseProjects(value: unknown): ProjectDTO[] {
  return z.array(projectDtoSchema).parse(value)
}
export function parseTasks(value: unknown): TaskDTO[] {
  return z.array(taskDtoSchema).parse(value)
}

/** Parse a single project row (the create-project response). */
export function parseProject(value: unknown): ProjectDTO {
  const [project] = parseProjects([value])
  if (!project) throw new Error('parseProject: malformed project response')
  return project
}

/** Parse a single task row (the set-estimate response, REQ-041). */
export function parseTask(value: unknown): TaskDTO {
  const [task] = parseTasks([value])
  if (!task) throw new Error('parseTask: malformed task response')
  return task
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

/** The effort-estimation patch for a task (REQ-041); `null` clears a field. */
export interface TaskEstimatePatch {
  readonly category?: string | null
  readonly complexity?: string | null
  readonly estimateMinutes?: number | null
}

/**
 * Persist a task's effort estimate (REQ-041) via `PATCH /api/tracking/tasks/:id` and return the
 * updated row. The client sends only the user's inputs; the deterministic baseline + estimate-vs-
 * actual are computed by the pure core (ADR-0005), never fabricated here.
 */
export async function setTaskEstimate(
  baseUrl: string,
  id: string,
  patch: TaskEstimatePatch,
  fetchImpl: typeof fetch = fetch,
): Promise<TaskDTO> {
  return parseTask(await patchJson(baseUrl, `/api/tracking/tasks/${id}`, patch, fetchImpl))
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
    list.push({
      id: task.id,
      name: task.name,
      spentMs: 0,
      done: task.archived,
      category: task.category,
      complexity: task.complexity,
      estimateMinutes: task.estimateMinutes,
    })
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
      fixedFeeMinor: p.fixedFeeMinor,
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
