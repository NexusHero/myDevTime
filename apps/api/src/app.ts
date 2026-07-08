import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import fastifySwagger from '@fastify/swagger'
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import type { Config } from './config.js'
import type { DbHandle } from './db/client.js'
import { AppError, type ProblemDetails } from './errors.js'
import { healthModule } from './modules/health/index.js'
import { authModule } from './modules/auth/index.js'
import { trackingModule } from './modules/tracking/index.js'
import { syncModule } from './modules/sync/index.js'
import { automationModule } from './modules/automation/index.js'
import { aiModule } from './modules/ai/index.js'
import { billingModule } from './modules/billing/index.js'

export interface AppDeps {
  config: Config
  db: DbHandle | null
}

const PROBLEM_CONTENT_TYPE = 'application/problem+json'

/**
 * Build the modular-monolith app: one Fastify instance where each module is an
 * encapsulated plugin registered under `/api/<module>` (ADR-0003/0015). Returns
 * a ready instance that is NOT yet listening — the caller (server / tests)
 * decides that.
 */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: deps.config.LOG_LEVEL,
      // Never log secrets/PII (SKILL §4/§8).
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  }).withTypeProvider<ZodTypeProvider>()

  // Zod drives both request validation and response serialization + OpenAPI.
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // One error handler maps typed domain errors → RFC 7807 problem+json.
  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.status).type(PROBLEM_CONTENT_TYPE).send(err.toProblem())
    }
    if (err.validation) {
      const problem: ProblemDetails = {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: err.message,
      }
      return reply.code(400).type(PROBLEM_CONTENT_TYPE).send(problem)
    }
    req.log.error({ err }, 'unhandled error')
    const problem: ProblemDetails = {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    }
    return reply.code(500).type(PROBLEM_CONTENT_TYPE).send(problem)
  })

  app.setNotFoundHandler((req, reply) => {
    const problem: ProblemDetails = {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: `Route ${req.method} ${req.url} not found`,
    }
    return reply.code(404).type(PROBLEM_CONTENT_TYPE).send(problem)
  })

  await app.register(fastifySwagger, {
    openapi: {
      info: { title: 'myDevTime API', version: '0.0.0' },
    },
    transform: jsonSchemaTransform,
  })

  // Operational routes.
  await app.register(healthModule({ db: deps.db }))

  // Business modules — each encapsulated under its own prefix.
  await app.register(authModule({ db: deps.db ? deps.db.db : null, config: deps.config }), {
    prefix: '/api/auth',
  })
  await app.register(trackingModule, { prefix: '/api/tracking' })
  await app.register(syncModule, { prefix: '/api/sync' })
  await app.register(automationModule, { prefix: '/api/automation' })
  await app.register(aiModule, { prefix: '/api/ai' })
  await app.register(billingModule, { prefix: '/api/billing' })

  await app.ready()
  return app
}
