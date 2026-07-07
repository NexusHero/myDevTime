import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { DbHandle } from '../../db/client.js'

/**
 * Liveness (`/health`, no I/O) and readiness (`/health/ready`, pings the DB).
 * Kept outside the business modules — it's a cross-cutting operational concern.
 */
export function healthModule(deps: { db: DbHandle | null }): FastifyPluginAsyncZod {
  return app => {
    app.get(
      '/health',
      {
        schema: {
          tags: ['health'],
          summary: 'Liveness — the process is up',
          response: { 200: z.object({ status: z.literal('ok') }) },
        },
      },
      () => ({ status: 'ok' as const }),
    )

    app.get(
      '/health/ready',
      {
        schema: {
          tags: ['health'],
          summary: 'Readiness — dependencies reachable',
          response: {
            200: z.object({ status: z.literal('ready'), db: z.literal('up') }),
            503: z.object({
              status: z.literal('not_ready'),
              db: z.enum(['down', 'not_configured']),
            }),
          },
        },
      },
      async (_req, reply) => {
        if (!deps.db) {
          return reply.code(503).send({ status: 'not_ready', db: 'not_configured' })
        }
        try {
          await deps.db.sql`select 1`
          return { status: 'ready', db: 'up' } as const
        } catch {
          return reply.code(503).send({ status: 'not_ready', db: 'down' })
        }
      },
    )

    return Promise.resolve()
  }
}
