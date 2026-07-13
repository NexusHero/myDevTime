import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger'
import { ZodValidationPipe } from 'nestjs-zod'
import type { Config } from './config.js'
import type { DbHandle } from './db/client.js'
import { AppModule } from './app.module.js'
import { ProblemDetailsFilter } from './core/problem-filter.js'

export interface AppDeps {
  config: Config
  db: DbHandle | null
}

/**
 * Build the NestJS application on the Fastify adapter (ADR-0025): global RFC 7807
 * filter, Zod validation pipe, raw-body capture (for the Stripe webhook), and the
 * OpenAPI document at `/docs`. The app is initialized (modules wired, Better-Auth
 * catch-all mounted) but NOT listening — the caller (`main.ts` / tests) decides
 * that, so tests can drive it with `app.inject(...)`. `packages/domain` stays pure;
 * Nest only wraps the HTTP edge.
 */
export async function buildApp(deps: AppDeps): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    // Trust X-Forwarded-* for the rate limiter's client IP only behind a trusted
    // proxy (ADR-0050); default off so a directly-reachable API can't be spoofed.
    trustProxy: deps.config.TRUST_PROXY,
    logger: {
      level: deps.config.LOG_LEVEL,
      // Never log secrets/PII (SKILL §4/§8).
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  })

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot({ config: deps.config, db: deps.db }),
    adapter,
    {
      bufferLogs: false,
      // The Stripe webhook verifies the raw request bytes against its signature.
      rawBody: true,
      // Mute Nest's own bootstrap logger (RouterExplorer, etc.) when the Fastify
      // logger is silenced — keeps the test/CI output clean; prod keeps full logs.
      ...(deps.config.LOG_LEVEL === 'silent' ? { logger: false as const } : {}),
    },
  )
  app.useGlobalFilters(new ProblemDetailsFilter())
  app.useGlobalPipes(new ZodValidationPipe())
  SwaggerModule.setup('docs', app, () => createOpenApiDocument(app))

  await app.init()
  return app
}

/** The OpenAPI document generated from the controllers/DTOs (nestjs-zod + swagger). */
export function createOpenApiDocument(app: NestFastifyApplication): OpenAPIObject {
  const openapi = new DocumentBuilder().setTitle('myDevTime API').setVersion('0.0.0').build()
  return SwaggerModule.createDocument(app, openapi)
}
