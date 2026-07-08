import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { fromNodeHeaders } from 'better-auth/node'
import { z } from 'zod'
import type { Config } from '../../config.js'
import type { Db } from '../../db/client.js'
import { moduleStatusRoute } from '../../core/module.js'
import { UnauthorizedError } from '../../errors.js'
import { createAuth } from './auth-instance.js'
import { createEmailPort } from './email-port.js'
import type { AuthenticatedUser } from './contract.js'

export interface AuthModuleDeps {
  readonly db: Db | null
  readonly config: Config
}

/**
 * The `auth` module (ADR-0003/0015/0017). Wrapped in `fastify-plugin` so the
 * `requireAuth` guard and `request.authUser` it decorates reach the root instance
 * — any module can then protect a route without importing Better-Auth. Better-Auth
 * owns `/api/auth/*`; the vendor stays inside this module. Without a DB (unit
 * tests / OpenAPI emit) only the status route is mounted and `requireAuth` replies
 * 401 (auth unavailable).
 */
export function authModule(deps: AuthModuleDeps): FastifyPluginAsync {
  return fp(async app => {
    const { db, config } = deps
    const auth = db ? createAuth({ db, config, email: createEmailPort(config, app.log) }) : null

    // Shared guard — decorated at the root (fastify-plugin lifts it out of the
    // encapsulation), so `preHandler: [app.requireAuth]` works from any module.
    app.decorateRequest('authUser', null)
    app.decorate('requireAuth', async request => {
      if (!auth) throw new UnauthorizedError('Authentication is not configured')
      const result = await auth.api.getSession({ headers: fromNodeHeaders(request.raw.headers) })
      if (!result) throw new UnauthorizedError('Authentication required')
      request.authUser = {
        id: result.user.id,
        email: result.user.email,
        emailVerified: result.user.emailVerified,
        name: result.user.name,
      } satisfies AuthenticatedUser
    })

    // Routes live under /api/auth in their own encapsulated scope.
    await app.register(
      async scoped => {
        await scoped.register(moduleStatusRoute('auth'))
        if (!auth) return

        // Better-Auth owns register / login / logout(-everywhere) / verify-email /
        // reset-password / delete-account / social sign-in / session listing under
        // /api/auth/*. Its wire format by design (ADR-0018).
        scoped.route({
          method: ['GET', 'POST'],
          url: '/*',
          handler: async (request, reply) => {
            const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)
            const response = await auth.handler(
              new Request(url.toString(), {
                method: request.method,
                headers: fromNodeHeaders(request.raw.headers),
                ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
              }),
            )
            reply.status(response.status)
            response.headers.forEach((value, key) => {
              reply.header(key, value)
            })
            const text = response.body ? await response.text() : null
            return reply.send(text)
          },
        })

        // Our own thin, documented route behind the shared guard.
        scoped.get(
          '/me',
          {
            preHandler: [scoped.requireAuth],
            schema: {
              tags: ['auth'],
              summary: 'The authenticated user (from the current session)',
              response: {
                200: z.object({
                  id: z.string(),
                  email: z.string(),
                  emailVerified: z.boolean(),
                  name: z.string(),
                }),
              },
            },
          },
          request => {
            const authenticated = request.authUser
            if (!authenticated) throw new UnauthorizedError('Authentication required')
            return authenticated
          },
        )
      },
      { prefix: '/api/auth' },
    )
  })
}
