import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { Db } from '../../db/client.js'
import * as svc from './service.js'
import { guard, type TrackingContext } from './context.js'
import {
  clientSchema,
  idParam,
  listQuery,
  name,
  projectSchema,
  tagSchema,
  taskSchema,
} from './schemas.js'

/**
 * Workspace catalog CRUD (REQ-001): clients → projects → tasks, plus tags.
 * Every route runs behind `requireAuth` and scopes to the caller's workspace
 * via `ctx`, so isolation holds by construction.
 */
export function catalogRoutes(db: Db, ctx: TrackingContext): FastifyPluginAsyncZod {
  const { workspaceOf } = ctx
  return app => {
    // ── Clients ────────────────────────────────────────────────────────────
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

    // ── Projects ───────────────────────────────────────────────────────────
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

    // ── Tasks ──────────────────────────────────────────────────────────────
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

    // ── Tags ───────────────────────────────────────────────────────────────
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
    return Promise.resolve()
  }
}
