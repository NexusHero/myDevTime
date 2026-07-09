import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { fromNodeHeaders } from 'better-auth/node'
import type { FastifyRequest } from 'fastify'
import { UnauthorizedError } from '../../errors.js'
import type { AuthenticatedUser } from './contract.js'
import { AUTH_INSTANCE, type AuthInstance } from './auth.tokens.js'

/**
 * The shared auth guard (ADR-0025, replaces the Fastify `requireAuth` decorator).
 * Validates the Better-Auth session and attaches the vendor-free `authUser` to the
 * request; 401 (problem+json via the filter) when unconfigured or unauthenticated.
 * Better-Auth types stay inside this module (ADR-0017 boundary).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AUTH_INSTANCE) private readonly auth: AuthInstance | null) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.auth) throw new UnauthorizedError('Authentication is not configured')
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const result = await this.auth.api.getSession({ headers: fromNodeHeaders(request.raw.headers) })
    if (!result) throw new UnauthorizedError('Authentication required')
    request.authUser = {
      id: result.user.id,
      email: result.user.email,
      emailVerified: result.user.emailVerified,
      name: result.user.name,
    } satisfies AuthenticatedUser
    return true
  }
}
