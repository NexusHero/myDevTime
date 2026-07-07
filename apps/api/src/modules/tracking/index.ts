import { moduleStatusRoute } from '../../core/module.js'

/** The `tracking` module as an encapsulated Fastify plugin (ADR-0003/0015). */
export const trackingModule = moduleStatusRoute('tracking')
