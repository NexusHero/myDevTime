import { Module } from '@nestjs/common'
import { CONFIG, type ConfigToken } from '../../core/tokens.js'
import { AuthModule } from '../auth/auth.module.js'
import { createStripeGateway } from './payments/stripe/gateway.js'
import { BillingContext } from './billing.context.js'
import { BillingController } from './billing.controller.js'
import { BillingStatusController } from './billing.status.controller.js'
import { StripeController } from './stripe.controller.js'
import { STRIPE_BASE_URL, STRIPE_GATEWAY, type StripeGatewayToken } from './billing.tokens.js'

/**
 * The `billing` module (REQ-005/009/016/017, ADR-0003/0006/0008/0025). Imports
 * `AuthModule` to consume the exported `AuthGuard`; `BillingContext` resolves each
 * caller's workspace over the `DB` token. The Stripe gateway is a provider that
 * resolves to the confined adapter when Stripe is configured, or `null` otherwise
 * (the controller answers 404). The deterministic money logic stays in
 * `packages/domain`; the Stripe SDK stays inside the gateway adapter.
 */
@Module({
  imports: [AuthModule],
  controllers: [BillingStatusController, BillingController, StripeController],
  providers: [
    BillingContext,
    {
      provide: STRIPE_GATEWAY,
      inject: [CONFIG],
      useFactory: (config: ConfigToken): StripeGatewayToken =>
        config.STRIPE_SECRET_KEY && config.STRIPE_WEBHOOK_SECRET
          ? createStripeGateway({
              secretKey: config.STRIPE_SECRET_KEY,
              webhookSecret: config.STRIPE_WEBHOOK_SECRET,
            })
          : null,
    },
    {
      provide: STRIPE_BASE_URL,
      inject: [CONFIG],
      useFactory: (config: ConfigToken): string =>
        config.AUTH_BASE_URL ?? `http://localhost:${String(config.PORT)}`,
    },
  ],
})
export class BillingModule {}
