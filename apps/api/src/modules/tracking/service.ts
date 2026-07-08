import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { clients, projects, tags, tasks } from '../../db/schema.js'
import { NotFoundError, ValidationError } from '../../errors.js'
import { canCreateChild, isValidName, normalizeName } from './validation.js'

/**
 * Workspace-scoped catalog service (REQ-001). EVERY function takes a
 * `workspaceId` non-optionally and scopes every query by it — a caller resolved
 * to workspace A can never read or write workspace B's rows (isolation by
 * construction; proven by the negative integration tests). Archived parents keep
 * their history but block new children.
 *
 * Deletes are **soft** (REQ-006, ADR-0019): a delete stamps `deleted_at` so the
 * row survives as a tombstone the sync engine can propagate. Every read filters
 * `deleted_at IS NULL`, so a soft-deleted row is invisible to the API exactly as
 * a hard-deleted one was.
 */

export type Client = typeof clients.$inferSelect
export type Project = typeof projects.$inferSelect
export type Task = typeof tasks.$inferSelect
export type Tag = typeof tags.$inferSelect

function requireName(raw: string): string {
  if (!isValidName(raw)) throw new ValidationError('name must be 1–200 characters')
  return normalizeName(raw)
}

function one<T>(rows: readonly T[], entity: string): T {
  const row = rows[0]
  if (!row) throw new NotFoundError(`${entity} not found`)
  return row
}

// ── Clients ────────────────────────────────────────────────────────────────

export async function createClient(
  db: Db,
  workspaceId: string,
  input: { name: string },
): Promise<Client> {
  const rows = await db
    .insert(clients)
    .values({ workspaceId, name: requireName(input.name) })
    .returning()
  return one(rows, 'client')
}

export function listClients(
  db: Db,
  workspaceId: string,
  includeArchived = false,
): Promise<Client[]> {
  const live = and(eq(clients.workspaceId, workspaceId), isNull(clients.deletedAt))
  const where = includeArchived ? live : and(live, eq(clients.archived, false))
  return db.select().from(clients).where(where).orderBy(clients.name)
}

export async function getClient(db: Db, workspaceId: string, id: string): Promise<Client> {
  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.workspaceId, workspaceId), eq(clients.id, id), isNull(clients.deletedAt)))
  return one(rows, 'client')
}

export async function updateClient(
  db: Db,
  workspaceId: string,
  id: string,
  patch: { name?: string | undefined; archived?: boolean | undefined },
): Promise<Client> {
  const values: Partial<typeof clients.$inferInsert> = { updatedAt: new Date() }
  if (patch.name !== undefined) values.name = requireName(patch.name)
  if (patch.archived !== undefined) values.archived = patch.archived
  const rows = await db
    .update(clients)
    .set(values)
    .where(and(eq(clients.workspaceId, workspaceId), eq(clients.id, id), isNull(clients.deletedAt)))
    .returning()
  return one(rows, 'client')
}

export async function deleteClient(db: Db, workspaceId: string, id: string): Promise<void> {
  const rows = await db
    .update(clients)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(clients.workspaceId, workspaceId), eq(clients.id, id), isNull(clients.deletedAt)))
    .returning({ id: clients.id })
  one(rows, 'client')
}

// ── Projects ───────────────────────────────────────────────────────────────

export interface ProjectInput {
  name: string
  clientId?: string | null | undefined
  color?: string | null | undefined
  billableDefault?: boolean | undefined
}

export async function createProject(
  db: Db,
  workspaceId: string,
  input: ProjectInput,
): Promise<Project> {
  const name = requireName(input.name)
  if (input.clientId) {
    // A project's client must be a live client in the same workspace.
    const client = await getClient(db, workspaceId, input.clientId)
    if (!canCreateChild(client)) throw new ValidationError('client is archived')
  }
  const rows = await db
    .insert(projects)
    .values({
      workspaceId,
      name,
      clientId: input.clientId ?? null,
      color: input.color ?? null,
      billableDefault: input.billableDefault ?? true,
    })
    .returning()
  return one(rows, 'project')
}

export function listProjects(
  db: Db,
  workspaceId: string,
  includeArchived = false,
): Promise<Project[]> {
  const live = and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt))
  const where = includeArchived ? live : and(live, eq(projects.archived, false))
  return db.select().from(projects).where(where).orderBy(projects.name)
}

export async function getProject(db: Db, workspaceId: string, id: string): Promise<Project> {
  const rows = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.workspaceId, workspaceId), eq(projects.id, id), isNull(projects.deletedAt)),
    )
  return one(rows, 'project')
}

export async function updateProject(
  db: Db,
  workspaceId: string,
  id: string,
  patch: {
    name?: string | undefined
    clientId?: string | null | undefined
    color?: string | null | undefined
    billableDefault?: boolean | undefined
    archived?: boolean | undefined
  },
): Promise<Project> {
  const values: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() }
  if (patch.name !== undefined) values.name = requireName(patch.name)
  if (patch.clientId !== undefined) {
    if (patch.clientId) await getClient(db, workspaceId, patch.clientId)
    values.clientId = patch.clientId
  }
  if (patch.color !== undefined) values.color = patch.color
  if (patch.billableDefault !== undefined) values.billableDefault = patch.billableDefault
  if (patch.archived !== undefined) values.archived = patch.archived
  const rows = await db
    .update(projects)
    .set(values)
    .where(
      and(eq(projects.workspaceId, workspaceId), eq(projects.id, id), isNull(projects.deletedAt)),
    )
    .returning()
  return one(rows, 'project')
}

export async function deleteProject(db: Db, workspaceId: string, id: string): Promise<void> {
  const rows = await db
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(projects.workspaceId, workspaceId), eq(projects.id, id), isNull(projects.deletedAt)),
    )
    .returning({ id: projects.id })
  one(rows, 'project')
}

// ── Tasks ──────────────────────────────────────────────────────────────────

export async function createTask(
  db: Db,
  workspaceId: string,
  input: { name: string; projectId: string; billableDefault?: boolean | undefined },
): Promise<Task> {
  const name = requireName(input.name)
  const project = await getProject(db, workspaceId, input.projectId)
  if (!canCreateChild(project)) throw new ValidationError('project is archived')
  const rows = await db
    .insert(tasks)
    .values({
      workspaceId,
      projectId: input.projectId,
      name,
      billableDefault: input.billableDefault ?? project.billableDefault,
    })
    .returning()
  return one(rows, 'task')
}

export function listTasks(db: Db, workspaceId: string, includeArchived = false): Promise<Task[]> {
  const live = and(eq(tasks.workspaceId, workspaceId), isNull(tasks.deletedAt))
  const where = includeArchived ? live : and(live, eq(tasks.archived, false))
  return db.select().from(tasks).where(where).orderBy(tasks.name)
}

export async function getTask(db: Db, workspaceId: string, id: string): Promise<Task> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.id, id), isNull(tasks.deletedAt)))
  return one(rows, 'task')
}

export async function updateTask(
  db: Db,
  workspaceId: string,
  id: string,
  patch: {
    name?: string | undefined
    billableDefault?: boolean | undefined
    archived?: boolean | undefined
  },
): Promise<Task> {
  const values: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() }
  if (patch.name !== undefined) values.name = requireName(patch.name)
  if (patch.billableDefault !== undefined) values.billableDefault = patch.billableDefault
  if (patch.archived !== undefined) values.archived = patch.archived
  const rows = await db
    .update(tasks)
    .set(values)
    .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.id, id), isNull(tasks.deletedAt)))
    .returning()
  return one(rows, 'task')
}

export async function deleteTask(db: Db, workspaceId: string, id: string): Promise<void> {
  const rows = await db
    .update(tasks)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.id, id), isNull(tasks.deletedAt)))
    .returning({ id: tasks.id })
  one(rows, 'task')
}

// ── Tags ───────────────────────────────────────────────────────────────────

export async function createTag(
  db: Db,
  workspaceId: string,
  input: { name: string; color?: string | null | undefined },
): Promise<Tag> {
  const rows = await db
    .insert(tags)
    .values({ workspaceId, name: requireName(input.name), color: input.color ?? null })
    .returning()
  return one(rows, 'tag')
}

export function listTags(db: Db, workspaceId: string, includeArchived = false): Promise<Tag[]> {
  const live = and(eq(tags.workspaceId, workspaceId), isNull(tags.deletedAt))
  const where = includeArchived ? live : and(live, eq(tags.archived, false))
  return db.select().from(tags).where(where).orderBy(tags.name)
}

export async function updateTag(
  db: Db,
  workspaceId: string,
  id: string,
  patch: {
    name?: string | undefined
    color?: string | null | undefined
    archived?: boolean | undefined
  },
): Promise<Tag> {
  const values: Partial<typeof tags.$inferInsert> = { updatedAt: new Date() }
  if (patch.name !== undefined) values.name = requireName(patch.name)
  if (patch.color !== undefined) values.color = patch.color
  if (patch.archived !== undefined) values.archived = patch.archived
  const rows = await db
    .update(tags)
    .set(values)
    .where(and(eq(tags.workspaceId, workspaceId), eq(tags.id, id), isNull(tags.deletedAt)))
    .returning()
  return one(rows, 'tag')
}

export async function deleteTag(db: Db, workspaceId: string, id: string): Promise<void> {
  const rows = await db
    .update(tags)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tags.workspaceId, workspaceId), eq(tags.id, id), isNull(tags.deletedAt)))
    .returning({ id: tags.id })
  one(rows, 'tag')
}
