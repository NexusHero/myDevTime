import { Inject, Logger, Module, type OnApplicationBootstrap } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import { fromNodeHeaders } from 'better-auth/node'
import type { FastifyInstance } from 'fastify'
import { CONFIG, DB, type ConfigToken, type DbToken } from '../../core/tokens.js'
import { createAuth } from './auth-instance.js'
import { createEmailPort } from './email-port.js'
import { AUTH_INSTANCE, type AuthInstance } from './auth.tokens.js'
import { AuthGuard } from './auth.guard.js'
import { AuthController } from './auth.controller.js'

/**
 * The `auth` module (ADR-0017/0025). Provides the confined Better-Auth instance
 * (null without a DB) + the shared `AuthGuard`, both exported so any protected
 * module can `@UseGuards(AuthGuard)` by importing this module. Better-Auth's
 * `/api/auth/*` catch-all is mounted on the raw Fastify instance (its wire format
 * bypasses Nest routing/validation by design); the vendor stays inside this file.
 */
@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_INSTANCE,
      inject: [CONFIG, DB],
      useFactory: (config: ConfigToken, db: DbToken) => {
        if (!db) return null
        const logger = new Logger('auth')
        const email = createEmailPort(config, {
          info: (obj, msg) => {
            logger.log(`${msg} ${JSON.stringify(obj)}`)
          },
        })
        return createAuth({ db, config, email })
      },
    },
    AuthGuard,
  ],
  exports: [AUTH_INSTANCE, AuthGuard],
})
export class AuthModule implements OnApplicationBootstrap {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(AUTH_INSTANCE) private readonly auth: AuthInstance | null,
    @Inject(CONFIG) private readonly config: ConfigToken,
  ) {}

  /** Mount Better-Auth's catch-all on Fastify before the server starts listening. */
  onApplicationBootstrap(): void {
    if (!this.auth) return
    const auth = this.auth
    const fastify = this.adapterHost.httpAdapter.getInstance<FastifyInstance>()
    fastify.route({
      method: ['GET', 'POST'],
      url: '/api/auth/*',
      handler: async (request, reply) => {
        // Resolve the request origin from the trusted, configured base URL —
        // never the client-controlled Host header (which Better-Auth would treat
        // as the canonical origin for cookies/redirects). AUTH_BASE_URL is
        // required in production (config superRefine); dev falls back to Host.
        const origin = this.config.AUTH_BASE_URL ?? `http://${request.headers.host ?? 'localhost'}`
        const url = new URL(request.url, origin)
        const response = await auth.handler(
          new Request(url.toString(), {
            method: request.method,
            headers: fromNodeHeaders(request.raw.headers),
            ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
          }),
        )
        // NB: never `await` the Fastify reply here — under the adapter the reply is
        // thenable and only settles once the response is sent, so awaiting it before
        // `send` deadlocks the request. `status`/`header` are synchronous & chainable.
        reply.status(response.status)
        response.headers.forEach((value, key) => {
          void reply.header(key, value)
        })
        const text = response.body ? await response.text() : null
        return reply.send(text)
      },
    })
  }
}
