import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { fromNodeHeaders } from 'better-auth/node'
import { z } from 'zod'
import type { Config } from '../../config.js'
import type { Db } from '../../db/client.js'
import { moduleStatusRoute } from '../../core/module.js'
import { UnauthorizedError } from '../../errors.js'
import { createAuth } from './auth-instance.js'
import { loggingEmailPort } from './email-port.js'
import type { AuthenticatedUser } from './contract.js'

export interface AuthModuleDeps {
  readonly db: Db | null
  readonly config: Config
}

/**
 * The `auth` module as an encapsulated Fastify plugin (ADR-0003/0015). Better-Auth
 * owns the identity endpoints under `/api/auth/*`; everything vendor-specific stays
 * here, upstream sees only `AuthenticatedUser`. Without a DB (unit tests / OpenAPI
 * emit) only the status route is mounted.
 */
export function authModule(deps: AuthModuleDeps): FastifyPluginAsyncZod {
  return async app => {
    await app.register(moduleStatusRoute('auth'))

    const { db, config } = deps
    if (!db) return

    const auth = createAuth({ db, config, email: loggingEmailPort(app.log) })

    // Better-Auth owns register / login / verify-email / reset-password / social
    // sign-in / session under /api/auth/*. Its wire format by design (ADR-0018);
    // our RFC-7807 contract governs the rest of the API.
    app.route({
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

    // Proof route behind our own boundary: resolve the session → AuthenticatedUser.
    app.get(
      '/me',
      {
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
      async request => {
        const result = await auth.api.getSession({ headers: fromNodeHeaders(request.raw.headers) })
        if (!result) throw new UnauthorizedError('Authentication required')
        const authenticated: AuthenticatedUser = {
          id: result.user.id,
          email: result.user.email,
          emailVerified: result.user.emailVerified,
          name: result.user.name,
        }
        return authenticated
      },
    )
  }
}
