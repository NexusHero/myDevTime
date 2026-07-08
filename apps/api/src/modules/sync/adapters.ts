import { and, eq, gt } from 'drizzle-orm'
import type { EntityState, SyncEntityType, SyncValue } from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { clients, projects, tags, tasks, timeEntries } from '../../db/schema.js'
import { ValidationError } from '../../errors.js'

/**
 * Storage adapters for the sync engine (REQ-006, ADR-0019) — the edge that maps
 * each syncable table's rows to and from the engine's storage-agnostic
 * `EntityState`. One adapter per entity type keeps the Drizzle-typed access in a
 * single place; the sync service orchestrates over them generically.
 *
 * `version` is stamped by a DB trigger, so every write returns the freshly
 * assigned version. `persist` is a workspace-scoped upsert: a push carrying an id
 * that belongs to another workspace matches nothing and returns `null`, so cross-
 * workspace writes are impossible by construction (isolation).
 */

export interface VersionedState {
  readonly version: number
  readonly state: EntityState
}

export interface EntityAdapter {
  readonly type: SyncEntityType
  changesSince(db: Db, workspaceId: string, since: number): Promise<VersionedState[]>
  load(db: Db, workspaceId: string, id: string): Promise<VersionedState | null>
  persist(db: Db, workspaceId: string, state: EntityState): Promise<VersionedState | null>
}

// ── Field coercion (a malformed push is a 400, never a crash) ─────────────────

function asString(v: SyncValue | undefined, field: string): string {
  if (typeof v !== 'string') throw new ValidationError(`sync: field "${field}" must be a string`)
  return v
}
function asStringOrNull(v: SyncValue | undefined): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw new ValidationError('sync: expected a string or null')
  return v
}
function asBool(v: SyncValue | undefined, field: string): boolean {
  if (typeof v !== 'boolean') throw new ValidationError(`sync: field "${field}" must be a boolean`)
  return v
}
function asNumber(v: SyncValue | undefined, field: string): number {
  if (typeof v !== 'number') throw new ValidationError(`sync: field "${field}" must be a number`)
  return v
}
function asNumberOrNull(v: SyncValue | undefined): number | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'number') throw new ValidationError('sync: expected a number or null')
  return v
}

function toMs(d: Date | null): number | null {
  return d === null ? null : d.getTime()
}
function fromMs(ms: number | null): Date | null {
  return ms === null ? null : new Date(ms)
}

interface SyncMeta {
  id: string
  version: number
  deletedAt: Date | null
  updatedAt: Date
}

function versioned(
  type: SyncEntityType,
  row: SyncMeta,
  fields: Record<string, SyncValue>,
): VersionedState {
  return {
    version: row.version,
    state: {
      type,
      id: row.id,
      deletedAt: toMs(row.deletedAt),
      updatedAt: row.updatedAt.getTime(),
      // The server does not attribute a device to its stored state; on an
      // updatedAt tie the incoming client edit (with a real deviceId) wins.
      deviceId: '',
      fields,
    },
  }
}

// ── Clients ──────────────────────────────────────────────────────────────────

const clientFields = (r: typeof clients.$inferSelect): Record<string, SyncValue> => ({
  name: r.name,
  archived: r.archived,
})

export const clientAdapter: EntityAdapter = {
  type: 'client',
  async changesSince(db, workspaceId, since) {
    const rows = await db
      .select()
      .from(clients)
      .where(and(eq(clients.workspaceId, workspaceId), gt(clients.version, since)))
    return rows.map(r => versioned('client', r, clientFields(r)))
  },
  async load(db, workspaceId, id) {
    const rows = await db
      .select()
      .from(clients)
      .where(and(eq(clients.workspaceId, workspaceId), eq(clients.id, id)))
    const r = rows[0]
    return r ? versioned('client', r, clientFields(r)) : null
  },
  async persist(db, workspaceId, state) {
    const set = {
      name: asString(state.fields.name, 'name'),
      archived: asBool(state.fields.archived, 'archived'),
      deletedAt: fromMs(state.deletedAt),
      updatedAt: new Date(state.updatedAt),
    }
    const rows = await db
      .insert(clients)
      .values({ id: state.id, workspaceId, ...set })
      .onConflictDoUpdate({ target: clients.id, set, where: eq(clients.workspaceId, workspaceId) })
      .returning()
    const r = rows[0]
    return r ? versioned('client', r, clientFields(r)) : null
  },
}

// ── Projects ──────────────────────────────────────────────────────────────────

const projectFields = (r: typeof projects.$inferSelect): Record<string, SyncValue> => ({
  name: r.name,
  clientId: r.clientId,
  color: r.color,
  billableDefault: r.billableDefault,
  hourlyRateOverride: r.hourlyRateOverride,
  archived: r.archived,
})

export const projectAdapter: EntityAdapter = {
  type: 'project',
  async changesSince(db, workspaceId, since) {
    const rows = await db
      .select()
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), gt(projects.version, since)))
    return rows.map(r => versioned('project', r, projectFields(r)))
  },
  async load(db, workspaceId, id) {
    const rows = await db
      .select()
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, id)))
    const r = rows[0]
    return r ? versioned('project', r, projectFields(r)) : null
  },
  async persist(db, workspaceId, state) {
    const set = {
      name: asString(state.fields.name, 'name'),
      clientId: asStringOrNull(state.fields.clientId),
      color: asStringOrNull(state.fields.color),
      billableDefault: asBool(state.fields.billableDefault, 'billableDefault'),
      hourlyRateOverride: asStringOrNull(state.fields.hourlyRateOverride),
      archived: asBool(state.fields.archived, 'archived'),
      deletedAt: fromMs(state.deletedAt),
      updatedAt: new Date(state.updatedAt),
    }
    const rows = await db
      .insert(projects)
      .values({ id: state.id, workspaceId, ...set })
      .onConflictDoUpdate({
        target: projects.id,
        set,
        where: eq(projects.workspaceId, workspaceId),
      })
      .returning()
    const r = rows[0]
    return r ? versioned('project', r, projectFields(r)) : null
  },
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

const taskFields = (r: typeof tasks.$inferSelect): Record<string, SyncValue> => ({
  name: r.name,
  projectId: r.projectId,
  billableDefault: r.billableDefault,
  archived: r.archived,
})

export const taskAdapter: EntityAdapter = {
  type: 'task',
  async changesSince(db, workspaceId, since) {
    const rows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.workspaceId, workspaceId), gt(tasks.version, since)))
    return rows.map(r => versioned('task', r, taskFields(r)))
  },
  async load(db, workspaceId, id) {
    const rows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.id, id)))
    const r = rows[0]
    return r ? versioned('task', r, taskFields(r)) : null
  },
  async persist(db, workspaceId, state) {
    const set = {
      name: asString(state.fields.name, 'name'),
      projectId: asString(state.fields.projectId, 'projectId'),
      billableDefault: asBool(state.fields.billableDefault, 'billableDefault'),
      archived: asBool(state.fields.archived, 'archived'),
      deletedAt: fromMs(state.deletedAt),
      updatedAt: new Date(state.updatedAt),
    }
    const rows = await db
      .insert(tasks)
      .values({ id: state.id, workspaceId, ...set })
      .onConflictDoUpdate({ target: tasks.id, set, where: eq(tasks.workspaceId, workspaceId) })
      .returning()
    const r = rows[0]
    return r ? versioned('task', r, taskFields(r)) : null
  },
}

// ── Tags ──────────────────────────────────────────────────────────────────────

const tagFields = (r: typeof tags.$inferSelect): Record<string, SyncValue> => ({
  name: r.name,
  color: r.color,
  archived: r.archived,
})

export const tagAdapter: EntityAdapter = {
  type: 'tag',
  async changesSince(db, workspaceId, since) {
    const rows = await db
      .select()
      .from(tags)
      .where(and(eq(tags.workspaceId, workspaceId), gt(tags.version, since)))
    return rows.map(r => versioned('tag', r, tagFields(r)))
  },
  async load(db, workspaceId, id) {
    const rows = await db
      .select()
      .from(tags)
      .where(and(eq(tags.workspaceId, workspaceId), eq(tags.id, id)))
    const r = rows[0]
    return r ? versioned('tag', r, tagFields(r)) : null
  },
  async persist(db, workspaceId, state) {
    const set = {
      name: asString(state.fields.name, 'name'),
      color: asStringOrNull(state.fields.color),
      archived: asBool(state.fields.archived, 'archived'),
      deletedAt: fromMs(state.deletedAt),
      updatedAt: new Date(state.updatedAt),
    }
    const rows = await db
      .insert(tags)
      .values({ id: state.id, workspaceId, ...set })
      .onConflictDoUpdate({ target: tags.id, set, where: eq(tags.workspaceId, workspaceId) })
      .returning()
    const r = rows[0]
    return r ? versioned('tag', r, tagFields(r)) : null
  },
}

// ── Time entries ────────────────────────────────────────────────────────────

const entryFields = (r: typeof timeEntries.$inferSelect): Record<string, SyncValue> => ({
  userId: r.userId,
  projectId: r.projectId,
  taskId: r.taskId,
  startedAt: r.startedAt.getTime(),
  endedAt: toMs(r.endedAt),
  billable: r.billable,
  source: r.source,
  note: r.note,
})

export const entryAdapter: EntityAdapter = {
  type: 'timeEntry',
  async changesSince(db, workspaceId, since) {
    const rows = await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.workspaceId, workspaceId), gt(timeEntries.version, since)))
    return rows.map(r => versioned('timeEntry', r, entryFields(r)))
  },
  async load(db, workspaceId, id) {
    const rows = await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.workspaceId, workspaceId), eq(timeEntries.id, id)))
    const r = rows[0]
    return r ? versioned('timeEntry', r, entryFields(r)) : null
  },
  async persist(db, workspaceId, state) {
    const startedMs = asNumber(state.fields.startedAt, 'startedAt')
    const set = {
      userId: asString(state.fields.userId, 'userId'),
      projectId: asStringOrNull(state.fields.projectId),
      taskId: asStringOrNull(state.fields.taskId),
      startedAt: new Date(startedMs),
      endedAt: fromMs(asNumberOrNull(state.fields.endedAt)),
      billable: asBool(state.fields.billable, 'billable'),
      source: asString(state.fields.source, 'source'),
      note: asStringOrNull(state.fields.note),
      deletedAt: fromMs(state.deletedAt),
      updatedAt: new Date(state.updatedAt),
    }
    const rows = await db
      .insert(timeEntries)
      .values({ id: state.id, workspaceId, ...set })
      .onConflictDoUpdate({
        target: timeEntries.id,
        set,
        where: eq(timeEntries.workspaceId, workspaceId),
      })
      .returning()
    const r = rows[0]
    return r ? versioned('timeEntry', r, entryFields(r)) : null
  },
}

export const ADAPTERS: Record<SyncEntityType, EntityAdapter> = {
  client: clientAdapter,
  project: projectAdapter,
  task: taskAdapter,
  tag: tagAdapter,
  timeEntry: entryAdapter,
}
