/**
 * Public contract of the `auth` module — Authentication & sessions (REQ-002). Issues #4/#5.
 *
 * Other modules depend ONLY on this file (interfaces/types), never on the
 * module's internals; wiring happens in app.ts. The boundary test enforces it.
 */
export interface AuthModule {
  readonly name: 'auth'
}
