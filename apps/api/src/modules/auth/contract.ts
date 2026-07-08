/**
 * Public contract of the `auth` module — Authentication & sessions (REQ-002). Issues #4/#5.
 *
 * Other modules depend ONLY on this file (interfaces/types), never on the
 * module's internals or Better-Auth types (ADR-0007/0017 boundary). The boundary
 * and confinement tests enforce it; wiring happens in app.ts.
 */

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
