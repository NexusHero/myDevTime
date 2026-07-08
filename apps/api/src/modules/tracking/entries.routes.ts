import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { Db } from '../../db/client.js'
import * as entries from './entries-service.js'
import { guard, type TrackingContext } from './context.js'
import { entrySchema, idParam } from './schemas.js'

/**
 * Time-entry routes (REQ-004): the live timer (start/stop/running) and manual
 * entries (create/list/get/edit/split/delete). Every route runs behind
 * `requireAuth` and scopes to the caller's workspace via `ctx`.
 */
export function entryRoutes(db: Db, ctx: TrackingContext): FastifyPluginAsyncZod {
  const { workspaceOf, contextOf } = ctx
  return app => {
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
    return Promise.resolve()
  }
}
