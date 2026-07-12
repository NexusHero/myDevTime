import { fromBool, toBool, type LocalDb, type Row } from './port.js'
import { newId, nowIso } from './ids.js'

/**
 * Catalog repository (REQ-001): clients → projects → tasks. Thin CRUD, no math,
 * workspace-scoped and tombstone-aware. Mirrors the server catalog shape so the
 * ADR-0019 sync engine reconciles the same rows.
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

function toProject(row: Row): LocalProject {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    clientId: row.client_id === null ? null : String(row.client_id),
    name: String(row.name),
    color: row.color === null ? null : String(row.color),
    billableDefault: toBool(row.billable_default ?? 1),
    archived: toBool(row.archived ?? 0),
  }
}

function toTask(row: Row): LocalTask {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    name: String(row.name),
    billableDefault: toBool(row.billable_default ?? 1),
    archived: toBool(row.archived ?? 0),
  }
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
  const rows = await db.getAllAsync(
    `SELECT id, workspace_id, client_id, name, color, billable_default, archived
       FROM projects
      WHERE workspace_id = ? AND deleted_at IS NULL AND archived = 0
      ORDER BY name`,
    [workspaceId],
  )
  return rows.map(toProject)
}

export async function createProject(
  db: LocalDb,
  workspaceId: string,
  input: CreateProjectInput,
): Promise<LocalProject> {
  const id = input.id ?? newId()
  const now = nowIso()
  const billableDefault = input.billableDefault ?? true
  await db.runAsync(
    `INSERT INTO projects
       (id, workspace_id, client_id, name, color, billable_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      workspaceId,
      input.clientId ?? null,
      input.name,
      input.color ?? null,
      fromBool(billableDefault),
      now,
      now,
    ],
  )
  return {
    id,
    workspaceId,
    clientId: input.clientId ?? null,
    name: input.name,
    color: input.color ?? null,
    billableDefault,
    archived: false,
  }
}

/** Active tasks for a project in the workspace, by name. */
export async function listTasks(
  db: LocalDb,
  workspaceId: string,
  projectId: string,
): Promise<LocalTask[]> {
  const rows = await db.getAllAsync(
    `SELECT id, workspace_id, project_id, name, billable_default, archived
       FROM tasks
      WHERE workspace_id = ? AND project_id = ? AND deleted_at IS NULL AND archived = 0
      ORDER BY name`,
    [workspaceId, projectId],
  )
  return rows.map(toTask)
}

export async function createTask(
  db: LocalDb,
  workspaceId: string,
  projectId: string,
  name: string,
  id: string = newId(),
): Promise<LocalTask> {
  const now = nowIso()
  await db.runAsync(
    `INSERT INTO tasks (id, workspace_id, project_id, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, workspaceId, projectId, name, now, now],
  )
  return { id, workspaceId, projectId, name, billableDefault: true, archived: false }
}
