import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { Config } from '../../config.js'
import type { Db } from '../../db/client.js'
import { moduleStatusRoute } from '../../core/module.js'
import { UnauthorizedError } from '../../errors.js'
import { resolveWorkspaceId } from './workspace.js'
import * as svc from './service.js'
import * as entries from './entries-service.js'

export interface TrackingModuleDeps {
  readonly db: Db | null
  readonly config: Config
}

// ── Response schemas (shared) ────────────────────────────────────────────────
const timestamps = { createdAt: z.date(), updatedAt: z.date() }
const clientSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  archived: z.boolean(),
  ...timestamps,
})
const projectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  clientId: z.string().nullable(),
  name: z.string(),
  color: z.string().nullable(),
  billableDefault: z.boolean(),
  hourlyRateOverride: z.string().nullable(),
  archived: z.boolean(),
  ...timestamps,
})
const taskSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string(),
  name: z.string(),
  billableDefault: z.boolean(),
  archived: z.boolean(),
  ...timestamps,
})
const tagSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  archived: z.boolean(),
  ...timestamps,
})

const entrySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  projectId: z.string().nullable(),
  taskId: z.string().nullable(),
  startedAt: z.date(),
  endedAt: z.date().nullable(),
  billable: z.boolean(),
  source: z.string(),
  note: z.string().nullable(),
  ...timestamps,
})

const idParam = z.object({ id: z.uuid() })
const listQuery = z.object({ includeArchived: z.coerce.boolean().default(false) })
const name = z.string().min(1).max(200)

/**
 * The `tracking` module (ADR-0003/0015): the workspace catalog CRUD (REQ-001).
 * Every route runs behind the shared `requireAuth` guard and resolves the
 * caller's workspace from their identity, so isolation is enforced by
 * construction. Without a DB (unit tests / OpenAPI emit) only the status route
 * is mounted.
 */
export function trackingModule(deps: TrackingModuleDeps): FastifyPluginAsyncZod {
  return async app => {
    await app.register(moduleStatusRoute('tracking'))
    const { db } = deps
    if (!db) return

    // Resolve (and provision on first use) the caller's workspace.
    const workspaceOf = async (request: FastifyRequest): Promise<string> => {
      const authUser = request.authUser
      if (!authUser) throw new UnauthorizedError('Authentication required')
      return resolveWorkspaceId(db, authUser.id, authUser.name)
    }

    // Both the caller's workspace and their user id (for entry ownership).
    const contextOf = async (
      request: FastifyRequest,
    ): Promise<{ workspaceId: string; userId: string }> => {
      const authUser = request.authUser
      if (!authUser) throw new UnauthorizedError('Authentication required')
      const workspaceId = await resolveWorkspaceId(db, authUser.id, authUser.name)
      return { workspaceId, userId: authUser.id }
    }

    const guard = (instance: FastifyInstance): { preHandler: [typeof instance.requireAuth] } => ({
      preHandler: [instance.requireAuth],
    })

    // ── Clients ──────────────────────────────────────────────────────────────
    app.post(
      '/clients',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          summary: 'Create a client',
          body: z.object({ name }),
          response: { 201: clientSchema },
        },
      },
      async (request, reply) => {
        const client = await svc.createClient(db, await workspaceOf(request), request.body)
        return reply.code(201).send(client)
      },
    )
    app.get(
      '/clients',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          querystring: listQuery,
          response: { 200: z.array(clientSchema) },
        },
      },
      async request =>
        svc.listClients(db, await workspaceOf(request), request.query.includeArchived),
    )
    app.get(
      '/clients/:id',
      {
        ...guard(app),
        schema: { tags: ['tracking'], params: idParam, response: { 200: clientSchema } },
      },
      async request => svc.getClient(db, await workspaceOf(request), request.params.id),
    )
    app.patch(
      '/clients/:id',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          params: idParam,
          body: z.object({ name: name.optional(), archived: z.boolean().optional() }),
          response: { 200: clientSchema },
        },
      },
      async request =>
        svc.updateClient(db, await workspaceOf(request), request.params.id, request.body),
    )
    app.delete(
      '/clients/:id',
      {
        ...guard(app),
        schema: { tags: ['tracking'], params: idParam, response: { 204: z.null() } },
      },
      async (request, reply) => {
        await svc.deleteClient(db, await workspaceOf(request), request.params.id)
        return reply.code(204).send(null)
      },
    )

    // ── Projects ─────────────────────────────────────────────────────────────
    app.post(
      '/projects',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          summary: 'Create a project',
          body: z.object({
            name,
            clientId: z.uuid().nullish(),
            color: z.string().nullish(),
            billableDefault: z.boolean().optional(),
          }),
          response: { 201: projectSchema },
        },
      },
      async (request, reply) => {
        const project = await svc.createProject(db, await workspaceOf(request), request.body)
        return reply.code(201).send(project)
      },
    )
    app.get(
      '/projects',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          querystring: listQuery,
          response: { 200: z.array(projectSchema) },
        },
      },
      async request =>
        svc.listProjects(db, await workspaceOf(request), request.query.includeArchived),
    )
    app.get(
      '/projects/:id',
      {
        ...guard(app),
        schema: { tags: ['tracking'], params: idParam, response: { 200: projectSchema } },
      },
      async request => svc.getProject(db, await workspaceOf(request), request.params.id),
    )
    app.patch(
      '/projects/:id',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          params: idParam,
          body: z.object({
            name: name.optional(),
            clientId: z.uuid().nullish(),
            color: z.string().nullish(),
            billableDefault: z.boolean().optional(),
            archived: z.boolean().optional(),
          }),
          response: { 200: projectSchema },
        },
      },
      async request =>
        svc.updateProject(db, await workspaceOf(request), request.params.id, request.body),
    )
    app.delete(
      '/projects/:id',
      {
        ...guard(app),
        schema: { tags: ['tracking'], params: idParam, response: { 204: z.null() } },
      },
      async (request, reply) => {
        await svc.deleteProject(db, await workspaceOf(request), request.params.id)
        return reply.code(204).send(null)
      },
    )

    // ── Tasks ────────────────────────────────────────────────────────────────
    app.post(
      '/tasks',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          summary: 'Create a task',
          body: z.object({
            name,
            projectId: z.uuid(),
            billableDefault: z.boolean().optional(),
          }),
          response: { 201: taskSchema },
        },
      },
      async (request, reply) => {
        const task = await svc.createTask(db, await workspaceOf(request), request.body)
        return reply.code(201).send(task)
      },
    )
    app.get(
      '/tasks',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          querystring: listQuery,
          response: { 200: z.array(taskSchema) },
        },
      },
      async request => svc.listTasks(db, await workspaceOf(request), request.query.includeArchived),
    )
    app.get(
      '/tasks/:id',
      {
        ...guard(app),
        schema: { tags: ['tracking'], params: idParam, response: { 200: taskSchema } },
      },
      async request => svc.getTask(db, await workspaceOf(request), request.params.id),
    )
    app.patch(
      '/tasks/:id',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          params: idParam,
          body: z.object({
            name: name.optional(),
            billableDefault: z.boolean().optional(),
            archived: z.boolean().optional(),
          }),
          response: { 200: taskSchema },
        },
      },
      async request =>
        svc.updateTask(db, await workspaceOf(request), request.params.id, request.body),
    )
    app.delete(
      '/tasks/:id',
      {
        ...guard(app),
        schema: { tags: ['tracking'], params: idParam, response: { 204: z.null() } },
      },
      async (request, reply) => {
        await svc.deleteTask(db, await workspaceOf(request), request.params.id)
        return reply.code(204).send(null)
      },
    )

    // ── Tags ─────────────────────────────────────────────────────────────────
    app.post(
      '/tags',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          summary: 'Create a tag',
          body: z.object({ name, color: z.string().nullish() }),
          response: { 201: tagSchema },
        },
      },
      async (request, reply) => {
        const tag = await svc.createTag(db, await workspaceOf(request), request.body)
        return reply.code(201).send(tag)
      },
    )
    app.get(
      '/tags',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          querystring: listQuery,
          response: { 200: z.array(tagSchema) },
        },
      },
      async request => svc.listTags(db, await workspaceOf(request), request.query.includeArchived),
    )
    app.patch(
      '/tags/:id',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          params: idParam,
          body: z.object({
            name: name.optional(),
            color: z.string().nullish(),
            archived: z.boolean().optional(),
          }),
          response: { 200: tagSchema },
        },
      },
      async request =>
        svc.updateTag(db, await workspaceOf(request), request.params.id, request.body),
    )
    app.delete(
      '/tags/:id',
      {
        ...guard(app),
        schema: { tags: ['tracking'], params: idParam, response: { 204: z.null() } },
      },
      async (request, reply) => {
        await svc.deleteTag(db, await workspaceOf(request), request.params.id)
        return reply.code(204).send(null)
      },
    )

    // ── Time entries (REQ-004) ─────────────────────────────────────────────────
    app.post(
      '/entries/timer/start',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          summary: 'Start a timer (stops any running one first)',
          body: z.object({
            projectId: z.uuid().nullish(),
            taskId: z.uuid().nullish(),
            billable: z.boolean().optional(),
            note: z.string().nullish(),
            startedAt: z.coerce.date().optional(),
          }),
          response: { 201: entrySchema },
        },
      },
      async (request, reply) => {
        const { workspaceId, userId } = await contextOf(request)
        const entry = await entries.startTimer(db, workspaceId, userId, request.body)
        return reply.code(201).send(entry)
      },
    )
    app.post(
      '/entries/timer/stop',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          summary: 'Stop the running timer',
          body: z.object({ endedAt: z.coerce.date().optional() }).optional(),
          response: { 200: entrySchema },
        },
      },
      async request => {
        const endedAt = request.body?.endedAt
        return entries.stopTimer(db, await workspaceOf(request), endedAt ?? new Date())
      },
    )
    app.get(
      '/entries/running',
      {
        ...guard(app),
        schema: { tags: ['tracking'], response: { 200: entrySchema.nullable() } },
      },
      async request => entries.getRunning(db, await workspaceOf(request)),
    )
    app.post(
      '/entries',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          summary: 'Create a manual time entry',
          body: z.object({
            startedAt: z.coerce.date(),
            endedAt: z.coerce.date(),
            projectId: z.uuid().nullish(),
            taskId: z.uuid().nullish(),
            billable: z.boolean().optional(),
            note: z.string().nullish(),
          }),
          response: { 201: entrySchema },
        },
      },
      async (request, reply) => {
        const { workspaceId, userId } = await contextOf(request)
        const entry = await entries.createManualEntry(db, workspaceId, userId, request.body)
        return reply.code(201).send(entry)
      },
    )
    app.get(
      '/entries',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          querystring: z.object({
            from: z.coerce.date().optional(),
            to: z.coerce.date().optional(),
          }),
          response: { 200: z.array(entrySchema) },
        },
      },
      async request => entries.listEntries(db, await workspaceOf(request), request.query),
    )
    app.get(
      '/entries/:id',
      {
        ...guard(app),
        schema: { tags: ['tracking'], params: idParam, response: { 200: entrySchema } },
      },
      async request => entries.getEntry(db, await workspaceOf(request), request.params.id),
    )
    app.patch(
      '/entries/:id',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          params: idParam,
          body: z.object({
            startedAt: z.coerce.date().optional(),
            endedAt: z.coerce.date().nullish(),
            projectId: z.uuid().nullish(),
            taskId: z.uuid().nullish(),
            billable: z.boolean().optional(),
            note: z.string().nullish(),
          }),
          response: { 200: entrySchema },
        },
      },
      async request =>
        entries.updateEntry(db, await workspaceOf(request), request.params.id, request.body),
    )
    app.post(
      '/entries/:id/split',
      {
        ...guard(app),
        schema: {
          tags: ['tracking'],
          summary: 'Split an entry at an instant into two adjacent entries',
          params: idParam,
          body: z.object({ at: z.coerce.date() }),
          response: { 200: z.tuple([entrySchema, entrySchema]) },
        },
      },
      async request =>
        entries.splitEntry(db, await workspaceOf(request), request.params.id, request.body.at),
    )
    app.delete(
      '/entries/:id',
      {
        ...guard(app),
        schema: { tags: ['tracking'], params: idParam, response: { 204: z.null() } },
      },
      async (request, reply) => {
        await entries.deleteEntry(db, await workspaceOf(request), request.params.id)
        return reply.code(204).send(null)
      },
    )
  }
}
