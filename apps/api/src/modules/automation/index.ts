import { moduleStatusRoute } from '../../core/module.js'

/** The `automation` module as an encapsulated Fastify plugin (ADR-0003/0015). */
export const automationModule = moduleStatusRoute('automation')
