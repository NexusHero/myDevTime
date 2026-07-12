import type { LocalDb } from './client.js'

export interface LocalProject {
  readonly id: string
  readonly name: string
  readonly color: string | null
  readonly clientName: string | null
  readonly billableDefault: boolean
  readonly archived: boolean
}

export interface LocalTask {
  readonly id: string
  readonly projectId: string
  readonly name: string
  readonly billableDefault: boolean
  readonly archived: boolean
}

function uuid(): string {
  return (
    (globalThis as any).crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

function rowToProject(row: Record<string, unknown>): LocalProject {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    color: (row['color'] as string) ?? null,
    clientName: (row['client_name'] as string) ?? null,
    billableDefault: (row['billable_default'] as number) === 1,
    archived: (row['archived'] as number) === 1,
  }
}

function rowToTask(row: Record<string, unknown>): LocalTask {
  return {
    id: row['id'] as string,
    projectId: row['project_id'] as string,
    name: row['name'] as string,
    billableDefault: (row['billable_default'] as number) === 1,
    archived: (row['archived'] as number) === 1,
  }
}

export async function listProjects(db: LocalDb): Promise<LocalProject[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM projects ORDER BY name ASC',
  )
  return rows.map(rowToProject)
}

export async function createProject(
  db: LocalDb,
  input: Omit<LocalProject, 'id' | 'archived'>,
): Promise<LocalProject> {
  const id = uuid()
  await db.runAsync(
    'INSERT INTO projects (id, name, color, client_name, billable_default, archived) VALUES (?, ?, ?, ?, ?, 0)',
    [id, input.name, input.color, input.clientName, input.billableDefault ? 1 : 0],
  )
  return { ...input, id, archived: false }
}

export async function listTasks(db: LocalDb, projectId: string): Promise<LocalTask[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM tasks WHERE project_id = ? ORDER BY name ASC',
    [projectId],
  )
  return rows.map(rowToTask)
}

export async function createTask(
  db: LocalDb,
  input: Omit<LocalTask, 'id' | 'archived'>,
): Promise<LocalTask> {
  const id = uuid()
  await db.runAsync(
    'INSERT INTO tasks (id, project_id, name, billable_default, archived) VALUES (?, ?, ?, ?, 0)',
    [id, input.projectId, input.name, input.billableDefault ? 1 : 0],
  )
  return { ...input, id, archived: false }
}
