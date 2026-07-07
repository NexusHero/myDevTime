import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

/** The modular-monolith boundaries from ADR-0003. */
export const MODULE_NAMES = ['auth', 'tracking', 'sync', 'automation', 'ai', 'billing'] as const
export type ModuleName = (typeof MODULE_NAMES)[number]

/**
 * Every business module registers a documented `/status` route — proof of the
 * plugin-per-module structure and a smoke target for the OpenAPI/boundary
 * checks. Real endpoints replace/extend this in the module's own issue.
 */
export function moduleStatusRoute(name: ModuleName): FastifyPluginAsyncZod {
  return app => {
    app.get(
      '/status',
      {
        schema: {
          tags: [name],
          summary: `${name} module status`,
          response: {
            200: z.object({ module: z.literal(name), status: z.literal('ok') }),
          },
        },
      },
      () => ({ module: name, status: 'ok' as const }),
    )
    return Promise.resolve()
  }
}
