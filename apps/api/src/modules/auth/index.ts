import { moduleStatusRoute } from '../../core/module.js'

/** The `auth` module as an encapsulated Fastify plugin (ADR-0003/0015). */
export const authModule = moduleStatusRoute('auth')
