import { moduleStatusRoute } from '../../core/module.js'

/** The `ai` module as an encapsulated Fastify plugin (ADR-0003/0015). */
export const aiModule = moduleStatusRoute('ai')
