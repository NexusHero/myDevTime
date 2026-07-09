import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { UnauthorizedError } from '../../errors.js'
import type { AuthenticatedUser } from './contract.js'

/** Reads the `authUser` the `AuthGuard` attached (ADR-0025); throws 401 if absent. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>()
    if (!request.authUser) throw new UnauthorizedError('Authentication required')
    return request.authUser
  },
)
