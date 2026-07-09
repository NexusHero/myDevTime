import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { AuthenticatedUser } from './contract.js'
import { AuthGuard } from './auth.guard.js'
import { CurrentUser } from './current-user.decorator.js'

/**
 * The `auth` module's own routes (ADR-0025): a documented `/status` and `/me`
 * behind the shared `AuthGuard`. Better-Auth's `/api/auth/*` (register, login,
 * logout, verify, reset, social, sessions — its wire format by design, ADR-0018)
 * is registered directly on the Fastify instance by `AuthModule` as a wildcard;
 * these static routes take precedence over it in the router.
 */
@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  @Get('status')
  status(): { module: 'auth'; status: 'ok' } {
    return { module: 'auth', status: 'ok' }
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user
  }
}
