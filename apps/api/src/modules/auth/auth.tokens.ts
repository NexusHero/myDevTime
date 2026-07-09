import type { createAuth } from './auth-instance.js'

/** DI token for the confined Better-Auth instance (or null without a DB). ADR-0017/0025. */
export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE')
export type AuthInstance = ReturnType<typeof createAuth>
