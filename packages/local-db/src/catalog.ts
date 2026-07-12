import { and, eq, isNull } from 'drizzle-orm'
import type { LocalDb } from './port.js'
import { drizzleFor } from './db.js'
import { clients, projects, tasks } from './tables.js'
import { newId, nowIso } from './ids.js'

/**
 * Catalog repository (REQ-001): clients → projects → tasks. Thin CRUD, no math,
 * workspace-scoped and tombstone-aware. Mirrors the server catalog shape so the
 * ADR-0019 sync engine reconciles the same rows. Queries go through Drizzle
 * (ADR-0046); the column projections below replace the old `SELECT` strings and
 * row mappers.
 */
export interface LocalProject {
  readonly id: string
  readonly workspaceId: string
  readonly clientId: string | null
  readonly name: string
  readonly color: string | null
  readonly billableDefault: boolean
  readonly archived: boolean
}

export interface LocalTask {
  readonly id: string
  readonly workspaceId: string
  readonly projectId: string
  readonly name: string
  readonly billableDefault: boolean
  readonly archived: boolean
}

export interface LocalClient {
  readonly id: string
  readonly workspaceId: string
  readonly name: string
  readonly archived: boolean
}

const clientCols = {
  id: clients.id,
  workspaceId: clients.workspaceId,
  name: clients.name,
  archived: clients.archived,
}

const projectCols = {
  id: projects.id,
  workspaceId: projects.workspaceId,
  clientId: projects.clientId,
  name: projects.name,
  color: projects.color,
  billableDefault: projects.billableDefault,
  archived: projects.archived,
}

const taskCols = {
  id: tasks.id,
  workspaceId: tasks.workspaceId,
  projectId: tasks.projectId,
  name: tasks.name,
  billableDefault: tasks.billableDefault,
  archived: tasks.archived,
}

export interface CreateProjectInput {
  readonly name: string
  readonly clientId?: string | null
  readonly color?: string | null
  readonly billableDefault?: boolean
  readonly id?: string
}

/** Active (non-archived, non-deleted) projects in the workspace, by name. */
export async function listProjects(db: LocalDb, workspaceId: string): Promise<LocalProject[]> {
  return drizzleFor(db)
    .select(projectCols)
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt),
        eq(projects.archived, false),
      ),
    )
    .orderBy(projects.name)
}

export async function createProject(
  db: LocalDb,
  workspaceId: string,
  input: CreateProjectInput,
): Promise<LocalProject> {
  const id = input.id ?? newId()
  const now = nowIso()
  const billableDefault = input.billableDefault ?? true
  const clientId = input.clientId ?? null
  const color = input.color ?? null
  await drizzleFor(db).insert(projects).values({
    id,
    workspaceId,
    clientId,
    name: input.name,
    color,
    billableDefault,
    createdAt: now,
    updatedAt: now,
  })
  return { id, workspaceId, clientId, name: input.name, color, billableDefault, archived: false }
}

/** Active tasks for a project in the workspace, by name. */
export async function listTasks(
  db: LocalDb,
  workspaceId: string,
  projectId: string,
): Promise<LocalTask[]> {
  return drizzleFor(db)
    .select(taskCols)
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, workspaceId),
        eq(tasks.projectId, projectId),
        isNull(tasks.deletedAt),
        eq(tasks.archived, false),
      ),
    )
    .orderBy(tasks.name)
}

export async function createTask(
  db: LocalDb,
  workspaceId: string,
  projectId: string,
  name: string,
  id: string = newId(),
): Promise<LocalTask> {
  const now = nowIso()
  await drizzleFor(db)
    .insert(tasks)
    .values({ id, workspaceId, projectId, name, createdAt: now, updatedAt: now })
  return { id, workspaceId, projectId, name, billableDefault: true, archived: false }
}

/** All active tasks in the workspace (across every project), by name. */
export async function listAllTasks(db: LocalDb, workspaceId: string): Promise<LocalTask[]> {
  return drizzleFor(db)
    .select(taskCols)
    .from(tasks)
    .where(
      and(eq(tasks.workspaceId, workspaceId), isNull(tasks.deletedAt), eq(tasks.archived, false)),
    )
    .orderBy(tasks.name)
}

/** Active clients in the workspace, by name. */
export async function listClients(db: LocalDb, workspaceId: string): Promise<LocalClient[]> {
  return drizzleFor(db)
    .select(clientCols)
    .from(clients)
    .where(
      and(
        eq(clients.workspaceId, workspaceId),
        isNull(clients.deletedAt),
        eq(clients.archived, false),
      ),
    )
    .orderBy(clients.name)
}

export async function createClient(
  db: LocalDb,
  workspaceId: string,
  name: string,
  id: string = newId(),
): Promise<LocalClient> {
  const now = nowIso()
  await drizzleFor(db)
    .insert(clients)
    .values({ id, workspaceId, name, createdAt: now, updatedAt: now })
  return { id, workspaceId, name, archived: false }
}
