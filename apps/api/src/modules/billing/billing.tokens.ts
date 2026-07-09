import type { StripeGateway } from './payments/stripe/gateway.js'

/**
 * DI tokens for the `billing` module (ADR-0025). `STRIPE_GATEWAY` resolves to the
 * confined Stripe adapter when Stripe is configured, or `null` otherwise — the
 * controllers surface 404 when it is absent (parity with the old "route not
 * mounted" behaviour). The Stripe SDK stays inside the gateway file.
 */
export const STRIPE_GATEWAY = Symbol('STRIPE_GATEWAY')
export type StripeGatewayToken = StripeGateway | null

/** The public base URL used when building Stripe redirect URLs. */
export const STRIPE_BASE_URL = Symbol('STRIPE_BASE_URL')
export type StripeBaseUrlToken = string
