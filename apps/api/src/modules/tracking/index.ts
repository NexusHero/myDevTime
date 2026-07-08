import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { Config } from '../../config.js'
import type { Db } from '../../db/client.js'
import { moduleStatusRoute } from '../../core/module.js'
import { createTrackingContext } from './context.js'
import { catalogRoutes } from './catalog.routes.js'
import { entryRoutes } from './entries.routes.js'

export interface TrackingModuleDeps {
  readonly db: Db | null
  readonly config: Config
}

/**
 * The `tracking` module (ADR-0003/0015) — composition root only: it wires the
 * per-request context and delegates to the focused route groups (catalog CRUD,
 * time entries), each behind the shared `requireAuth` guard. Without a DB
 * (unit tests / OpenAPI emit) only the status route is mounted.
 */
export function trackingModule(deps: TrackingModuleDeps): FastifyPluginAsyncZod {
  return async app => {
    await app.register(moduleStatusRoute('tracking'))
    const { db } = deps
    if (!db) return

    const ctx = createTrackingContext(db)
    await app.register(catalogRoutes(db, ctx))
    await app.register(entryRoutes(db, ctx))
  }
}
