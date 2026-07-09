import { Controller, Inject, Post, Req, UseGuards, type RawBodyRequest } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyRequest } from 'fastify'
import { CONFIG, type ConfigToken } from '../../core/tokens.js'
import { NotFoundError, ValidationError } from '../../errors.js'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import * as stripeSvc from './payments/stripe/service.js'
import { BillingContext } from './billing.context.js'
import {
  STRIPE_BASE_URL,
  STRIPE_GATEWAY,
  type StripeBaseUrlToken,
  type StripeGatewayToken,
} from './billing.tokens.js'

/**
 * The Stripe web rail (REQ-017, ADR-0006/0025, #22). Checkout/portal run behind
 * `AuthGuard` and resolve the caller's workspace; the webhook is authenticated by
 * its Stripe signature (not the session) and verifies the raw request bytes. When
 * Stripe is not configured the gateway token is null and these routes answer 404,
 * matching the old "route not mounted" behaviour. The Stripe SDK stays confined to
 * the gateway adapter.
 */
@ApiTags('billing')
@Controller('api/billing')
export class StripeController {
  constructor(
    private readonly ctx: BillingContext,
    @Inject(CONFIG) private readonly config: ConfigToken,
    @Inject(STRIPE_GATEWAY) private readonly gateway: StripeGatewayToken,
    @Inject(STRIPE_BASE_URL) private readonly baseUrl: StripeBaseUrlToken,
  ) {}

  private requireGateway(): NonNullable<StripeGatewayToken> {
    if (!this.gateway) throw new NotFoundError('Stripe is not configured')
    return this.gateway
  }

  @Post('checkout')
  @UseGuards(AuthGuard)
  async checkout(@CurrentUser() user: AuthenticatedUser): Promise<{ url: string }> {
    const gateway = this.requireGateway()
    if (!this.config.STRIPE_PRICE_PRO)
      throw new ValidationError('STRIPE_PRICE_PRO is not configured')
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const url = await stripeSvc.startCheckout(
      db,
      gateway,
      { priceId: this.config.STRIPE_PRICE_PRO, baseUrl: this.baseUrl },
      workspaceId,
    )
    return { url }
  }

  @Post('portal')
  @UseGuards(AuthGuard)
  async portal(@CurrentUser() user: AuthenticatedUser): Promise<{ url: string }> {
    const gateway = this.requireGateway()
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const url = await stripeSvc.startPortal(db, gateway, this.baseUrl, workspaceId)
    if (!url) throw new NotFoundError('No billing customer for this workspace yet')
    return { url }
  }

  @Post('stripe/webhook')
  async webhook(@Req() request: RawBodyRequest<FastifyRequest>): Promise<{ received: boolean }> {
    const gateway = this.requireGateway()
    const db = this.ctx.database()
    const signature = request.headers['stripe-signature']
    if (typeof signature !== 'string') throw new ValidationError('missing stripe-signature')
    const raw = request.rawBody
    if (!raw) throw new ValidationError('missing request body')
    const body = raw.toString('utf8')
    try {
      await stripeSvc.handleWebhook(db, gateway, { body, signature })
    } catch {
      // A bad signature (or malformed payload) is a 400 so Stripe surfaces it.
      throw new ValidationError('invalid Stripe signature')
    }
    return { received: true }
  }
}
