import { moduleStatusRoute } from '../../core/module.js'

/** The `sync` module as an encapsulated Fastify plugin (ADR-0003/0015). */
export const syncModule = moduleStatusRoute('sync')
