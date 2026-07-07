import { moduleStatusRoute } from '../../core/module.js'

/** The `billing` module as an encapsulated Fastify plugin (ADR-0003/0015). */
export const billingModule = moduleStatusRoute('billing')
