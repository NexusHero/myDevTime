import { Controller, Get, Inject, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CONFIG, type ConfigToken } from '../../core/tokens.js'
import type { AuthenticatedUser } from './contract.js'
import { AuthGuard } from './auth.guard.js'
import { CurrentUser } from './current-user.decorator.js'

/** The auth methods this deployment offers — the login/register screens read this
 *  to know which buttons to enable (a social provider only works once its OAuth
 *  client id + secret are configured). */
export interface AuthProviders {
  readonly emailPassword: boolean
  readonly social: readonly ('google' | 'apple' | 'github')[]
}

/**
 * The `auth` module's own routes (ADR-0025): a documented `/status`, `/me` behind
 * the shared `AuthGuard`, and a public `/providers`. Better-Auth's `/api/auth/*`
 * (register, login, logout, verify, reset, social, sessions — its wire format by
 * design, ADR-0018) is registered directly on the Fastify instance by `AuthModule`
 * as a wildcard; these static routes take precedence over it in the router.
 */
@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(@Inject(CONFIG) private readonly config: ConfigToken) {}

  @Get('status')
  status(): { module: 'auth'; status: 'ok' } {
    return { module: 'auth', status: 'ok' }
  }

  /** Which sign-in methods are actually configured (public — the login gate needs
   *  it before any session exists). A social provider appears only when both its
   *  client id and secret are set, mirroring `createAuth`'s `socialProviders`. */
  @Get('providers')
  providers(): AuthProviders {
    const c = this.config
    const social: ('google' | 'apple' | 'github')[] = []
    if (c.GOOGLE_CLIENT_ID && c.GOOGLE_CLIENT_SECRET) social.push('google')
    if (c.APPLE_CLIENT_ID && c.APPLE_CLIENT_SECRET) social.push('apple')
    if (c.GITHUB_CLIENT_ID && c.GITHUB_CLIENT_SECRET) social.push('github')
    return { emailPassword: true, social }
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user
  }
}
