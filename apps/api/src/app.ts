import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import type { FastifyInstance } from 'fastify'
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
  registerRequestId(adapter.getInstance())
  registerSecurityHeaders(adapter.getInstance(), deps.config)
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

/** An accepted inbound request id: printable token characters only, bounded length. */
const REQUEST_ID_RE = /^[\w.-]{1,128}$/

/**
 * Request-id propagation (REQ-021): echo a well-formed inbound `x-request-id`
 * (so a client/gateway trace id survives the hop) or fall back to Fastify's own
 * per-request id. The header is stamped in `onRequest`, before any handler or
 * error path runs, so EVERY response — success, 4xx, 5xx — is traceable. Inbound
 * values are sanitized (charset + length) so a hostile header can't smuggle
 * newlines or unbounded junk into logs and responses.
 */
function registerRequestId(instance: FastifyInstance): void {
  instance.addHook('onRequest', async (req, reply) => {
    const inbound = req.headers['x-request-id']
    const candidate = Array.isArray(inbound) ? inbound[0] : inbound
    const id = candidate && REQUEST_ID_RE.test(candidate) ? candidate : req.id
    void reply.header('x-request-id', id)
  })
}

/**
 * Baseline security headers on every response (REQ-019), set in one `onSend`
 * hook — no extra dependency (helmet) needed for a fixed header set. HSTS is
 * only meaningful (and only honored by browsers) over TLS, so it is sent when
 * the request actually arrived via https or the deployment is production
 * (where TLS terminates at the edge and the app may see plain http).
 *
 * Deliberately NO Content-Security-Policy: this API serves no HTML except the
 * Swagger UI at `/docs`, which relies on inline scripts/styles a strict CSP
 * would break. Rather than shipping a loophole-ridden CSP with 'unsafe-inline'
 * carve-outs for the docs route, CSP is omitted entirely; the headers below
 * (nosniff, frame denial, referrer/permissions lockdown, COOP) are the ones
 * that matter for a JSON API.
 */
function registerSecurityHeaders(instance: FastifyInstance, config: Config): void {
  instance.addHook('onSend', async (req, reply, payload: unknown) => {
    void reply.header('X-Content-Type-Options', 'nosniff')
    void reply.header('X-Frame-Options', 'DENY')
    void reply.header('Referrer-Policy', 'no-referrer')
    void reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    void reply.header('Cross-Origin-Opener-Policy', 'same-origin')
    if (req.protocol === 'https' || config.NODE_ENV === 'production') {
      void reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
    return payload
  })
}
