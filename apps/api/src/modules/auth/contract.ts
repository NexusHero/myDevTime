/**
 * Public contract of the `auth` module — Authentication & sessions (REQ-002). Issues #4/#5.
 *
 * Other modules depend ONLY on this file, never on the module's internals or
 * Better-Auth types (ADR-0007/0017/0025 boundary). Under NestJS the cross-module
 * surface is the identity type plus the guard/param-decorator any protected module
 * uses (`@UseGuards(AuthGuard)` + `@CurrentUser()`); they are re-exported here so
 * the boundary test's "import only contract.js" rule holds. The boundary and
 * confinement tests enforce it; wiring happens in `AuthModule`.
 */

/** The identity the rest of the app sees — never a Better-Auth session/user. */
export interface AuthenticatedUser {
  readonly id: string
  readonly email: string
  readonly emailVerified: boolean
  readonly name: string
}

export { AuthGuard } from './auth.guard.js'
export { CurrentUser } from './current-user.decorator.js'

/**
 * The `AuthGuard` attaches the vendor-free identity to the request; the
 * `CurrentUser` param decorator reads it back. This augmentation is the typed
 * hand-off between them — no module imports Better-Auth to see the caller.
 */
declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthenticatedUser | null
  }
}
