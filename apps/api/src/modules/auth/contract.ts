/**
 * Public contract of the `auth` module — Authentication & sessions (REQ-002). Issues #4/#5.
 *
 * Other modules depend ONLY on this file (interfaces/types), never on the
 * module's internals or Better-Auth types (ADR-0007/0017 boundary). The boundary
 * and confinement tests enforce it; wiring happens in app.ts.
 */

import type { preHandlerHookHandler } from 'fastify'

/** The identity the rest of the app sees — never a Better-Auth session/user. */
export interface AuthenticatedUser {
  readonly id: string
  readonly email: string
  readonly emailVerified: boolean
  readonly name: string
}

export interface AuthModule {
  readonly name: 'auth'
}

/**
 * The auth module decorates the root instance (via fastify-plugin) so any module
 * can guard a route with `preHandler: [app.requireAuth]` and then read
 * `request.authUser` — without importing Better-Auth. `requireAuth` replies 401
 * (problem+json) when there is no valid session.
 */
declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: preHandlerHookHandler
  }
  interface FastifyRequest {
    authUser: AuthenticatedUser | null
  }
}
