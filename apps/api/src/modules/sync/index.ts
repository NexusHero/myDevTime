import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { Config } from '../../config.js'
import type { Db } from '../../db/client.js'
import { moduleStatusRoute } from '../../core/module.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import { UnauthorizedError } from '../../errors.js'
import { pullChanges, pushChanges } from './service.js'

export interface SyncModuleDeps {
  readonly db: Db | null
  readonly config: Config
}

const syncValue = z.union([z.string(), z.number(), z.boolean(), z.null()])
const entityType = z.enum(['client', 'project', 'task', 'tag', 'timeEntry'])
const entityState = z.object({
  type: entityType,
  id: z.string(),
  deletedAt: z.number().nullable(),
  updatedAt: z.number(),
  deviceId: z.string(),
  fields: z.record(z.string(), syncValue),
})

const pushBody = z.object({
  changes: z.array(
    z.object({
      type: entityType,
      opId: z.string().min(1),
      base: entityState.nullable(),
      incoming: entityState,
    }),
  ),
})
const pushResponse = z.object({
  results: z.array(
    z.object({
      opId: z.string(),
      outcome: z.enum(['applied', 'skipped', 'surfaced']),
      version: z.number(),
      state: entityState,
    }),
  ),
})
const pullQuery = z.object({ since: z.coerce.number().int().nonnegative().default(0) })
const pullResponse = z.object({
  changes: z.array(z.object({ version: z.number(), state: entityState })),
  watermark: z.number(),
})

/**
 * The `sync` module (ADR-0003/0019): cross-device delta sync (REQ-006). Both
 * routes run behind `requireAuth` and resolve the caller's workspace from their
 * identity, so a device can only ever sync its own workspace. Without a DB
 * (unit tests / OpenAPI emit) only the status route is mounted.
 */
export function syncModule(deps: SyncModuleDeps): FastifyPluginAsyncZod {
  return async app => {
    await app.register(moduleStatusRoute('sync'))
    const { db } = deps
    if (!db) return

    const workspaceOf = async (request: FastifyRequest): Promise<string> => {
      const authUser = request.authUser
      if (!authUser) throw new UnauthorizedError('Authentication required')
      return resolveWorkspaceId(db, authUser.id, authUser.name)
    }
    const guard = (instance: FastifyInstance): { preHandler: [typeof instance.requireAuth] } => ({
      preHandler: [instance.requireAuth],
    })

    app.post(
      '/push',
      {
        ...guard(app),
        schema: {
          tags: ['sync'],
          summary: 'Push local changes; conflicts are resolved or surfaced',
          body: pushBody,
          response: { 200: pushResponse },
        },
      },
      async (request): Promise<z.infer<typeof pushResponse>> => {
        const out = await pushChanges(db, await workspaceOf(request), request.body.changes)
        return out as z.infer<typeof pushResponse>
      },
    )

    app.get(
      '/pull',
      {
        ...guard(app),
        schema: {
          tags: ['sync'],
          summary: 'Pull all changes newer than the watermark',
          querystring: pullQuery,
          response: { 200: pullResponse },
        },
      },
      async (request): Promise<z.infer<typeof pullResponse>> => {
        const out = await pullChanges(db, await workspaceOf(request), request.query.since)
        return out as z.infer<typeof pullResponse>
      },
    )
  }
}
